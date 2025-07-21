import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { TaskMetadata } from "@/lib/types/types";
import { Logging } from "@/lib/utils/Logging";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StreamEvent } from "@langchain/core/dist/tracers/event_stream";
import { LangChainProviderFactory } from "@/lib/llm";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { BaseMessage } from "@langchain/core/messages";
import { profileStart, profileEnd } from "@/lib/utils/Profiler";
import { StreamEventBus } from "@/lib/events";
import { StreamEventProcessor } from "../events/StreamEventProcessor";
import { ToolRegistry } from "@/lib/tools/base/ToolRegistry";
import BrowserContext from "../browser/BrowserContext";
import { getDomainFromUrl } from "../browser/Utils";
import { Runnable } from "@langchain/core/runnables";
import { RunnableConfig } from "@langchain/core/runnables";

// Import composition interfaces
import { IToolSet, ToolSetFactory } from "./toolsets/ToolSetManager";
import { IPromptStrategy, PromptStrategyFactory } from "./prompts/PromptStrategy";
import { IExecutionStrategy } from "./execution/ExecutionStrategy";

//refactoring schemas => moving it to agent/schemas
import {
  AgentInputSchema,
  AgentOutputSchema,
  AgentOptionsSchema
} from "./schemas/base/BaseSchemas"

//refactoring configs => moving it to agent/config
import { BASE_AGENT, BASE_AGENT_STREAMING } from "./config/base/BaseConfig";

export type AgentInput = z.infer<typeof AgentInputSchema>;
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
export type AgentOptions = z.infer<typeof AgentOptionsSchema>;

/**
 * Interface for all agent types - now extends Runnable for LangGraph compatibility
 */
export interface IAgent extends Runnable<AgentInput, AgentOutput> {
  invoke(input: AgentInput, config?: RunnableConfig): Promise<AgentOutput>;
}

/**
 * Abstract base class for LangChain-based agents.
 * Uses composition pattern with lazy initialization for better performance.
 */
export abstract class BaseAgent
  extends Runnable<AgentInput, AgentOutput>
  implements IAgent
{
  // ✅ Lazy initialization
  private _toolSet: IToolSet | null = null;
  private _promptStrategy: IPromptStrategy | null = null;
  private _executionStrategy: IExecutionStrategy | null = null;

  protected readonly options: AgentOptions;
  protected readonly executionContext: ExecutionContext;
  protected readonly browserContext: BrowserContext;
  protected debugMode: boolean;

  // ✅ Add missing properties
  protected toolRegistry: ToolRegistry | undefined;
  protected systemPrompt: string = '';
  protected isInitialized: boolean = false;

  // LangChain namespace requirement - ✅ Make it concrete, not abstract
  lc_namespace = BASE_AGENT.LANGCHAIN_NAMESPACE;

  // State management for derived agents
  protected stateMessageAdded: boolean = false;
  protected systemPromptAdded: boolean = false;
  
  // Store current EventBus for streaming
  protected currentEventBus: StreamEventBus | null = null;

  constructor(options: AgentOptions) {
    super();
    this.options = AgentOptionsSchema.parse(options);
    this.executionContext = this.options.executionContext;
    this.browserContext = this.executionContext.browserContext;
    this.debugMode = this.options.debugMode || this.executionContext.debugMode;
    
    // ✅ Don't create immediately - use getters
  }
  
  protected get toolSet(): IToolSet {
    if (!this._toolSet) {
      this._toolSet = this.createToolSet();
    }
    return this._toolSet;
  }
  
  protected get promptStrategy(): IPromptStrategy {
    if (!this._promptStrategy) {
      this._promptStrategy = this.createPromptStrategy();
    }
    return this._promptStrategy;
  }
  
  protected get executionStrategy(): IExecutionStrategy {
    if (!this._executionStrategy) {
      this._executionStrategy = this.createExecutionStrategy();
    }
    return this._executionStrategy;
  }

  // ✅ Add abstract factory methods for subclasses to implement
  protected abstract createToolSet(): IToolSet;
  protected abstract createPromptStrategy(): IPromptStrategy;
  protected abstract createExecutionStrategy(): IExecutionStrategy;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // ✅ Lazy access triggers creation only when needed
      this.toolRegistry = this.toolSet.getToolRegistry();
      
      // ✅ Update tool docs efficiently
      const toolDocs = this.toolRegistry?.generateSystemPrompt() || '';
      if (toolDocs && 'updateToolDocs' in this.promptStrategy) {
        (this.promptStrategy as any).updateToolDocs(toolDocs);
      }
      
      this.systemPrompt = this.options.systemPrompt || this.promptStrategy.generateSystemPrompt();

      this.isInitialized = true;

      if (this.debugMode) {
        this.log(`${this.getAgentName()} initialized (LLM will be created lazily)`);
      }
    } catch (error) {
      this.log(`Failed to initialize ${this.getAgentName()}: ${error}`, "error");
      throw error;
    }
  }

  /**
   * Ensure the agent is initialized before execution
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Template method: Get agent-specific initialization message
   * @returns Initialization message
   */
  protected getInitializationMessage(): string {
    return `${BASE_AGENT.LOG_PREFIXES.INITIALIZING} ${this.getAgentName().toLowerCase()}...`;
  }

  /**
   * Main execution method - implements Runnable interface
   */
  public async invoke(
    input: AgentInput,
    config?: RunnableConfig,
  ): Promise<AgentOutput> {
    const validatedInput = AgentInputSchema.parse(input);
    const profileLabel = `Agent.${this.getAgentName()}`;
    
    profileStart(profileLabel);

    try {
      await this.ensureInitialized();
      
      // Extract EventBus from ExecutionContext only
      this.currentEventBus = this.executionContext.getEventBus();

      if (this.debugMode) {
        this.log(
          `${BASE_AGENT.LOG_PREFIXES.STARTING} ${this.getAgentName()} execution: ${
            validatedInput.instruction
          }`
        );
        this.log(`${BASE_AGENT.LOG_PREFIXES.STARTING} ${this.getAgentName()} task...`);
      }

      // Execute agent-specific logic - each agent handles its own orchestration
      const agentResult = await this.executeAgent(
        validatedInput,
        config
      );

      // Log completion internally for debugging
      if (this.debugMode) {
        this.log(`${BASE_AGENT.LOG_PREFIXES.COMPLETED} ${this.getAgentName()} completed successfully`);
      }

      return {
        success: true,
        result: agentResult,
        metadata: {
          agentName: this.getAgentName(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isAbortError = this.isAbortError(error, errorMessage);

      if (!isAbortError) {
        this.log(`${BASE_AGENT.LOG_PREFIXES.FAILED} ${this.getAgentName()} failed: ${errorMessage}`, "error");
        this.currentEventBus?.emitSystemError(
          errorMessage,
          error instanceof Error ? error : undefined,
          this.getAgentName()
        );
        this.currentEventBus?.emitSystemMessage(
          `${BASE_AGENT.LOG_PREFIXES.FAILED} ${this.getAgentName()} failed: ${errorMessage}`,
          'error',
          this.getAgentName()
        );
      } else {
        this.log(`${this.getAgentName()} cancelled: ${errorMessage}`, "info");
      }

      return {
        success: false,
        result: null,
        error: errorMessage,
        metadata: {
          agentName: this.getAgentName(),
          timestamp: new Date().toISOString(),
          cancelled: isAbortError,
        },
      };
    } finally {
      this.currentEventBus = null;
      profileEnd(profileLabel);
    }
  }

  /**
   * Helper method for centralized streaming execution that agents can use
   */
  protected async executeReactAgentWithStreaming(
    agent: any,
    instruction: string,
    config?: RunnableConfig,
    messages?: BaseMessage[]
  ): Promise<{ result: any; allMessages: any[] }> {
    const profileLabel = `${this.getAgentName()}.invokeWithStreaming`;
    profileStart(profileLabel);
    
    const eventBus = this.executionContext.getEventBus();
    if (!eventBus) {
      throw new Error('EventBus not available in ExecutionContext - ensure setEventBus() was called');
    }
    
    this.currentEventBus = eventBus;
    
    if (BASE_AGENT_STREAMING.EMIT_THINKING_ON_START) {
      eventBus.emitThinking(
        `${BASE_AGENT.TOOL_SETUP_MESSAGE} ${this.getAgentName()} tools`,
        'info',
        this.getAgentName()
      );
    }

    const toolRegistry = this.getToolRegistry();

    if (!toolRegistry) {
      throw new Error(`Tool registry not available for ${this.getAgentName()}`);
    }

    if (this.debugMode) {
      this.log(
        `Using existing tool registry with ${
          toolRegistry.getAll().length
        } tools`
      );
    }

    const streamEventProcessor = new StreamEventProcessor(
      eventBus,
      toolRegistry
    );

    if (this.debugMode) {
      this.log(`StreamEventProcessor initialized with existing tool registry`);
    }

    if (this.executionContext.abortController.signal.aborted) {
      throw new Error("Task was cancelled before execution");
    }

    const eventStream = await agent.streamEvents(
      {
        messages: messages || [new HumanMessage(instruction)],
      },
      {
        version: BASE_AGENT_STREAMING.VERSION,
        signal: this.executionContext.abortController.signal,
        recursionLimit: this.options.maxIterations,
        ...config,
      }
    );

    let result: any;
    let allMessages: any[] = [];
    let wasCancelled = false;

    try {
      for await (const event of eventStream) {
        if (BASE_AGENT_STREAMING.CHECK_CANCELLATION && this.executionContext.abortController.signal.aborted) {
          wasCancelled = true;
          break;
        }

        await streamEventProcessor.processEvent(event);
        await this.syncLangchainAndMessageManager(event, streamEventProcessor);

        if (event.event === "on_chain_end") {
          const output = event.data?.output;

          if (result === undefined && typeof output === "string") {
            result = output;
          }

          if (output && typeof output === "object" && Array.isArray(output.messages)) {
            result = output;
            allMessages = output.messages;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes(BASE_AGENT.KNOWN_LANGRAPH_ERROR)) {
          this.log(
            "Encountered known LangGraph streaming issue - continuing execution",
            "info"
          );
        } else if (error.name === "AbortError") {
          wasCancelled = true;
          this.log("Task was cancelled by user", "info");
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (BASE_AGENT_STREAMING.COMPLETE_ON_FINISH) {
      streamEventProcessor.completeStreaming();
    }

    if (wasCancelled) {
      eventBus.emitCancel('Task was cancelled', true, this.getAgentName());
      profileEnd(profileLabel);
      throw new Error("Task was cancelled");
    }

    profileEnd(profileLabel);
    return { result, allMessages };
  }

  /**
   * Template methods for subclasses to implement
   */
  protected abstract getAgentName(): string;
  protected abstract executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<unknown>;

  /**
   * Template method: Create agent-specific tools
   */
  protected createTools(): any[] {
    return this.toolRegistry?.getLangChainTools() || [];
  }

  /**
   * Template method: Get tool registry for streaming display
   */
  protected getToolRegistry(): ToolRegistry | undefined {
    return this.toolRegistry;
  }

  /**
   * Get LLM provider using current user settings
   */
  protected async getLLM(): Promise<BaseChatModel> {
    try {
      const llm = await LangChainProviderFactory.createLLM();
      return llm;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(`Failed to create LLM provider: ${errorMessage}`, "error");
      throw new Error(`LLM provider creation failed: ${errorMessage}`);
    }
  }

  protected async enhanceInstructionWithContext(
    instruction: string
  ): Promise<string> {
    try {
      const pageUrl = await this.browserContext.getCurrentPage().then(p => p.url());  
      const pageTitle = await this.browserContext.getCurrentPage().then(p => p.title());

      return `${instruction}\n\n## BROWSER CONTEXT\nCurrent URL: ${pageUrl}\nPage Title: ${pageTitle}`;
    } catch (error) {
      this.log(
        `Failed to enhance instruction with context: ${error}`,
        "warning"
      );
      return instruction;
    }
  }

  protected async getSelectedTabsInstruction(): Promise<string> {
    const selectedTabIds =
      this.executionContext.getSelectedTabIds() || undefined;

    if (selectedTabIds && selectedTabIds.length > 1) {
      const tabInfoList: Array<{
        id: number;
        title: string;
        url: string;
        domain: string;
      }> = [];

      for (const tabId of selectedTabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const tabDomain = getDomainFromUrl(tab.url || "unknown");

          tabInfoList.push({
            id: tabId,
            title: tab.title || "Untitled",
            url: tab.url || "about:blank",
            domain: tabDomain,
          });
        } catch (error) {
          // If tab can't be accessed, don't add it to the list
        }
      }

      let selectedTabsInstruction = `## USER TAB SELECTED CONTEXT\n🔗 **User has selected ${
        tabInfoList.length
      } tabs:**\n\nJSON: ${JSON.stringify(tabInfoList)}`;

      selectedTabsInstruction += `\n\n**TAB PROCESSING INSTRUCTIONS:**\n• Content from all ${tabInfoList.length} tabs should be considered collectively\n• When summarizing or analyzing, include information from all selected tabs\n• Mention which tabs specific information comes from when relevant\n• Consider relationships and connections between the different tabs`;
      return selectedTabsInstruction;
    }

    return "";
  }

  protected async syncLangchainAndMessageManager(
    event: StreamEvent,
    streamEventProcessor?: StreamEventProcessor
  ): Promise<void> {
    try {
      if (event.event === "on_chat_model_end") {
        if (event.data?.output instanceof AIMessageChunk) {
          this.executionContext.messageManager.addAIMessage(
            event.data?.output.text
          );
        }
      } else if (event.event === "on_tool_end") {
        const output = event.data?.output;
        const toolName = event.name || "unknown";

        if (
          output &&
          streamEventProcessor &&
          "getActionResults" in streamEventProcessor
        ) {
          const actionResults = streamEventProcessor.getActionResults();

          const recentResult = actionResults
            .filter((ar: any) => ar.toolName === toolName)
            .pop();

          if (recentResult && recentResult.includeInMemory) {
            const contentToAdd =
              recentResult.extractedContent ||
              (output instanceof ToolMessage
                ? (output.content as string)
                : typeof output === "string"
                ? output
                : JSON.stringify(output));

            this.executionContext.messageManager.addToolMessage(
              contentToAdd,
              toolName
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error syncing LangChain and MessageManager: ${error}`, "error");
    }
  }

  protected log(
    message: string,
    level: "info" | "warning" | "error" = "info",
    data?: any
  ): void {
    if (this.debugMode || level === "error") {
      Logging.log(this.getAgentName(), message, level);
    }
    
    if (this.debugMode && this.currentEventBus && level !== "error") {
      this.currentEventBus.emitDebugMessage(`[${this.getAgentName()}] ${message}`, data, this.getAgentName());
    }
  }

  public async cleanup(): Promise<void> {
    try {
      this._toolSet = null;
      this._promptStrategy = null;
      this._executionStrategy = null;
      
      await this.executionContext.browserContext.cleanup();
      
    } catch (error) {
      this.log(`Failed to cleanup: ${error}`, "error");
    }
  }

  private isAbortError(error: unknown, errorMessage: string): boolean {
    if (!(error instanceof Error)) return false;
    
    return error.name === "AbortError" || 
      BASE_AGENT.ABORT_ERROR_PATTERNS.some(pattern => 
        errorMessage.includes(pattern)
      );
  }
}