import { z } from 'zod';
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { IToolSet, ToolSetFactory } from './toolsets/ToolSetManager';
import { IPromptStrategy, PromptStrategyFactory } from './prompts/PromptStrategy';
import { IExecutionStrategy, LLMOnlyExecutionStrategy } from './execution/ExecutionStrategy';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';

/**
 * Classification output schema for routing decisions
 */
export const ClassificationOutputSchema = z.object({
  task_type: z.enum(['productivity', 'browse', 'answer'])
});

export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

/**
 * Agent specialized for classifying user intents and routing to appropriate workflows.
 */
export class ClassificationAgent extends BaseAgent {
  constructor(options: AgentOptions) {
    super(options);
  }

  /**
   * Create tool set for the agent using composition
   */
  protected createToolSet(): IToolSet {
    return ToolSetFactory.createToolSet('empty', this.executionContext); // No tools needed
  }

  /**
   * Create prompt strategy for the agent using composition
   */
  protected createPromptStrategy(): IPromptStrategy {
    return PromptStrategyFactory.createStrategy('classification');
  }

  /**
   * Create execution strategy for the agent using composition
   */
  protected createExecutionStrategy(): IExecutionStrategy {
    return new LLMOnlyExecutionStrategy(); // Classification doesn't use ReAct
  }
  
  /**
   * Get the agent name for logging
   */
  protected getAgentName(): string {
    return 'ClassificationAgent';
  }
  
  /**
   * Execute classification task using composition
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<ClassificationOutput> {
    try {
      this.log(`🎯 Classifying user request: ${input.instruction}`);
      
      await this.ensureInitialized();
      
      // Create structured output schema for LLM
      const classificationSchema = z.object({
        task_type: z.enum(['productivity', 'browse', 'answer']).describe('Whether this is a productivity task, browse task, or answer task')
      });
      
      // Get LLM and create structured output
      const llm = await this.getLLM();
      const structuredLLM = await withFlexibleStructuredOutput(llm, classificationSchema);
      
      // Use prompt strategy to build prompts
      const systemPrompt = this.promptStrategy.generateSystemPrompt();
      const userPrompt = this.promptStrategy.generateUserPrompt(input.instruction);

      // Get classification from LLM
      const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ], config);
      
      this.log(`✅ Classification result: ${result.task_type}`);
      
      return result as ClassificationOutput;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Classification failed: ${errorMessage}`, 'error');
      
      // Default to productivity path on error
      return {
        task_type: 'productivity'
      };
    }
  }
}
