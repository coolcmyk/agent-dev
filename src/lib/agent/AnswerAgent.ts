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
    // Create strategy without tool docs initially
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
    // Use the execution strategy to handle the actual execution
    const result = await this.executionStrategy.execute(input, config, this);
    
    return {
      success: true,
      status_message: ''
    };
  }
}