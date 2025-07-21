import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';

// Import new prompt system
import { ProductivityAgentPrompt } from '@/lib/prompts';

// Import new tool system
import { ToolRegistry } from '@/lib/tools/base';
import { 
  TabOperationsTool,
  GroupTabsTool 
} from '@/lib/tools/tab';
import { 
  SaveBookmarkTool,
  BookmarkManagementTool,
  BookmarkSearchTool,
  BookmarksFolderTool
} from '@/lib/tools/bookmarks';
import { SessionManagementTool, SessionExecutionTool } from '@/lib/tools/sessions';
import { NoOpTool, TerminateTool, GetDateTool } from '@/lib/tools/utility';
import { GetSelectedTabsTool } from '@/lib/tools/tab';
import { GetHistoryTool, StatsHistoryTool } from '@/lib/tools/history';
import { IToolSet, ToolSetFactory } from "./toolsets/ToolSetManager";
import { IPromptStrategy, PromptStrategyFactory } from "./prompts/PromptStrategy";
import { IExecutionStrategy, ReactExecutionStrategy } from "./execution/ExecutionStrategy";

/**
 * Productivity agent output schema
 */
export const ProductivityOutputSchema = z.object({
  completed: z.boolean(),  // Whether the productivity task was completed
  result: z.string(),  // Description of what was accomplished
  data: z.record(z.unknown()).optional()  // Any data retrieved (tab info, bookmarks, etc.)
});

export type ProductivityOutput = z.infer<typeof ProductivityOutputSchema>;

/**
 * Agent specialized for productivity features like tab management, workspace organization,
 * and browser efficiency improvements.
 */
export class ProductivityAgent extends BaseAgent {
  /**
   * Creates a new instance of ProductivityAgent
   * @param options - Configuration options for the productivity agent
   */
  constructor(options: AgentOptions) {
    super(options);
  }

  /**
   * Override: Get the agent name for logging
   * @returns Agent name
   */
  protected getAgentName(): string {
    return 'ProductivityAgent';
  }
  
  /**
   * Override: Create tool set for the agent
   * @returns IToolSet with productivity tools
   */
  protected createToolSet(): IToolSet {
    return ToolSetFactory.createToolSet('productivity', this.executionContext);
  }
  
  /**
   * Override: Create prompt strategy for the agent
   * @returns IPromptStrategy for productivity agent
   */
  protected createPromptStrategy(): IPromptStrategy {
    // The tool docs will be available after initialization
    return PromptStrategyFactory.createStrategy('productivity', '');
  }
  
  /**
   * Override: Create execution strategy for the agent
   * @returns IExecutionStrategy for productivity agent
   */
  protected createExecutionStrategy(): IExecutionStrategy {
    return new ReactExecutionStrategy();
  }

  /**
   * Execute productivity agent - handles instruction enhancement and execution
   * @param input - Agent input containing instruction and context
   * @param callbacks - Optional streaming callbacks
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Parsed productivity output
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<ProductivityOutput> {
    try {
      await this.ensureInitialized();

      // Create the ReAct agent
      this.log(`🎯 Creating productivity agent`);
      
      // 1. Add system prompt to message history at position 0 (agent-specific)
      this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      this.systemPromptAdded = true;

      const selectedTabsInstruction = await this.getSelectedTabsInstruction();
      if (selectedTabsInstruction) {
        this.executionContext.messageManager.addHumanMessage(`[Context: ${selectedTabsInstruction}]`);
      }

      // Get LLM and tools
      const llm = await this.getLLM();
      const tools = this.createTools();
      const isGemini = llm._llmType()?.indexOf('google') !== -1 || false;
      const messages = this.executionContext.messageManager.getMessages(isGemini);

      // Create ReAct agent
      const agent = createReactAgent({
        llm,
        tools,
      });

      // Use centralized streaming execution
      const { result, allMessages } = await this.executeReactAgentWithStreaming(
        agent,
        input.instruction,
        config,
        messages
      );

      // TODO(nithin): This final message is often just some AImessagechunk from langchain and it has nothing. 
      // I should remove extracting this final message or using it for anything like marking done or something.
      const finalMessage = allMessages[allMessages.length - 1];
      const resultText =
        typeof finalMessage?.content === "string"
          ? finalMessage.content
          : "Task completed";

      // Remove system prompt after execution
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }

      this.log(`✅ Productivity task completed successfully`);

      return {
        completed: true,
        result: resultText,
        data: {}, // Can be enhanced to include specific data based on task type
      };
    } catch (error) {
      // Ensure system prompt is cleaned up on error
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(`❌ Productivity task failed: ${errorMessage}`, "error");

      return {
        completed: false,
        result: `Task failed: ${errorMessage}`,
        data: {},
      };
    }
  }
}