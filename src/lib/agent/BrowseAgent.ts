import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { IToolSet, ToolSetFactory } from './toolsets/ToolSetManager';
import { IPromptStrategy, PromptStrategyFactory } from './prompts/PromptStrategy';
import { IExecutionStrategy, ReactExecutionStrategy } from './execution/ExecutionStrategy';

/**
 * Browse agent output schema
 */
export const BrowseOutputSchema = z.object({
  completed: z.boolean(),
  actions_taken: z.array(z.string()),
  final_state: z.string(),
  extracted_data: z.record(z.unknown()).optional()
});

export type BrowseOutput = z.infer<typeof BrowseOutputSchema>;

/**
 * Agent specialized for web browsing automation using ReAct pattern.
 */
export class BrowseAgent extends BaseAgent {
  constructor(options: AgentOptions) {
    super(options);
  }

  /**
   * Create tool set for the agent using composition
   */
  protected createToolSet(): IToolSet {
    return ToolSetFactory.createToolSet('browse', this.executionContext);
  }

  /**
   * Create prompt strategy for the agent using composition
   */
  protected createPromptStrategy(): IPromptStrategy {
    return PromptStrategyFactory.createStrategy('browse');
  }

  /**
   * Create execution strategy for the agent using composition
   */
  protected createExecutionStrategy(): IExecutionStrategy {
    return new ReactExecutionStrategy();
  }

  /**
   * Get the agent name for logging
   */
  protected getAgentName(): string {
    return 'BrowseAgent';
  }

  /**
   * Execute browsing agent using composition
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<BrowseOutput> {
    try {
      await this.ensureInitialized();

      // 1. Add system prompt (agent-specific)
      this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      this.systemPromptAdded = true;
      
      // 2. Add browser state before execution
      if (!this.stateMessageAdded) {
        const browserState = await this.executionContext.browserContext.getBrowserStateString();
        this.executionContext.messageManager.addBrowserStateMessage(browserState);
        this.stateMessageAdded = true;
        
        // Debug: Log browser state details
        const currentPage = await this.browserContext.getCurrentPage();
        this.log('🌐 Browser state captured', 'info', {
          url: currentPage.url(),
          title: await currentPage.title(),
          useVision: this.options.useVision,
          hasScreenshot: browserState.includes('Screenshot:')
        });
      }

      // Add selected tabs instruction if any
      const selectedTabsInstruction = await this.getSelectedTabsInstruction();
      if (selectedTabsInstruction) {
        this.executionContext.messageManager.addHumanMessage(`[Context: ${selectedTabsInstruction}]`);
      }

      // Get LLM and tools
      const llm = await this.getLLM();
      const tools = this.createTools();
      const isGemini = llm._llmType()?.indexOf('google') !== -1 || false;
      const messages = this.executionContext.messageManager.getMessages(isGemini);
      
      // Debug: Log agent configuration
      this.log('🤖 Creating browse agent', 'info', {
        instruction: input.instruction,
        toolCount: tools.length,
        tools: tools.map(t => t.name),
        llmType: llm._llmType(),
        messageCount: messages.length,
        hasSelectedTabs: !!selectedTabsInstruction
      });
      
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
      
      // 3. Remove browser state and system prompt after execution
      if (this.stateMessageAdded) {
        this.executionContext.messageManager.removeBrowserStateMessages();
        this.stateMessageAdded = false;
      }
      
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }
      
      // Extract the final message content and model output
      const lastMessage = allMessages[allMessages.length - 1];
      const finalContent = typeof lastMessage?.content === 'string' 
        ? lastMessage.content 
        : 'Task completed';
      
      // Check for done tool usage to determine completion
      const actionsTaken: string[] = [];
      let completed = false;
      
      for (const message of allMessages) {
        if ('tool_calls' in message && message.tool_calls && Array.isArray(message.tool_calls)) {
          for (const toolCall of message.tool_calls) {
            actionsTaken.push(`${toolCall.name}: ${JSON.stringify(toolCall.args)}`);
            if (toolCall.name === 'done') {
              completed = true;
            }
          }
        }
      }
      
      this.log('🏁 Browse execution complete', 'info', {
        completed,
        actionCount: actionsTaken.length,
        toolCalls: actionsTaken.map(action => action.split(':')[0]),
        finalStateLength: finalContent.length
      });
      
      return {
        completed,
        actions_taken: actionsTaken,
        final_state: finalContent,
        extracted_data: input.context || {}
      };
      
    } catch (error) {
      // Ensure state and system prompt are cleaned up on error
      if (this.stateMessageAdded) {
        this.executionContext.messageManager.removeBrowserStateMessages();
        this.stateMessageAdded = false;
      }
      
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log('❌ Browse task failed', 'error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        completed: false,
        actions_taken: [],
        final_state: `Task failed: ${errorMessage}`,
        extracted_data: {}
      };
    }
  }
}
