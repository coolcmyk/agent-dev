import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';
import { profileStart, profileEnd } from '@/lib/utils/Profiler';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { IToolSet, ToolSetFactory } from './toolsets/ToolSetManager';
import { IPromptStrategy, PromptStrategyFactory } from './prompts/PromptStrategy';
import { IExecutionStrategy, ReactExecutionStrategy } from './execution/ExecutionStrategy';

/**
 * Answer agent output schema
 */
export const AnswerOutputSchema = z.object({
  success: z.boolean(),
  status_message: z.string()
});

export type AnswerOutput = z.infer<typeof AnswerOutputSchema>;

/**
 * Agent specialized for answering questions about web page content.
 */
export class AnswerAgent extends BaseAgent {
  constructor(options: AgentOptions) {
    super(options);
  }

  /**
   * Create tool set for the agent using composition
   */
  protected createToolSet(): IToolSet {
    return ToolSetFactory.createToolSet('answer', this.executionContext);
  }

  /**
   * Create prompt strategy for the agent using composition
   */
  protected createPromptStrategy(): IPromptStrategy {
    return PromptStrategyFactory.createStrategy('answer');
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
    return 'AnswerAgent';
  }

  /**
   * Execute agent-specific logic using composition
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<AnswerOutput> {
    profileStart('AnswerAgent.executeAgent');
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Extract follow-up context from input
      const followUpContext = input.context ? {
        isFollowUp: Boolean(input.context.isFollowUp) || false,
        previousTaskType: input.context.previousTaskType as string | undefined
      } : undefined;
      
      this.log('📋 Answer task context', 'info', {
        question: input.instruction,
        isFollowUp: followUpContext?.isFollowUp || false,
        previousTaskType: followUpContext?.previousTaskType || 'none'
      });
      
      // 1. Add system prompt to message history (agent-specific)
      this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      this.systemPromptAdded = true;

      // Get selected tabs context if available
      const selectedTabIds = this.executionContext.getSelectedTabIds();
      if (selectedTabIds && selectedTabIds.length > 0) {
        const tabContext = `[Context: You have access to ${selectedTabIds.length} selected tab(s) with IDs: ${selectedTabIds.join(', ')}. Use these tabs to answer the user's question.]`;
        this.executionContext.messageManager.addHumanMessage(tabContext);
        
        this.log('🔍 Tab selection', 'info', {
          selectedTabCount: selectedTabIds.length,
          tabIds: selectedTabIds
        });
      }

      // Get LLM and tools
      const llm = await this.getLLM();
      const tools = this.createTools();
      const isGemini = llm._llmType()?.indexOf('google') !== -1 || false;
      const messages = this.executionContext.messageManager.getMessages(isGemini);

      this.log('🤖 Creating ReAct agent', 'info', {
        toolCount: tools.length,
        tools: tools.map(t => t.name),
        llmType: llm._llmType(),
        messageCount: messages.length
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

      // 2. Remove system prompt after execution
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }

      const success = true;
      
      const executionTime = Date.now() - startTime;
      this.log('✅ Answer generation complete', 'info', {
        totalMessages: allMessages.length,
        executionTime: executionTime
      });

      profileEnd('AnswerAgent.executeAgent');
      
      return {
        success,
        status_message: ''
      };

    } catch (error) {
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Answer generation failed: ${errorMessage}`, 'error');

      profileEnd('AnswerAgent.executeAgent');
      
      return {
        success: false,
        status_message: `Failed to generate answer: ${errorMessage}`
      };
    }
  }
}