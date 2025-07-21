import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { IToolSet, ToolSetFactory } from './toolsets/ToolSetManager';
import { IPromptStrategy, PromptStrategyFactory } from './prompts/PromptStrategy';
import { IExecutionStrategy, LLMOnlyExecutionStrategy } from './execution/ExecutionStrategy';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';
import { profileStart, profileEnd, profileAsync } from '@/lib/utils/Profiler';

// Planner output schema
export const PlannerOutputSchema = z.object({
  plan: z.array(z.string()),
  reasoning: z.string(),
  complexity: z.enum(['low', 'medium', 'high']),
  estimated_steps: z.number(),
  requires_interaction: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low'])
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

/**
 * Agent specialized for planning web automation tasks.
 */
export class PlannerAgent extends BaseAgent {
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
    return PromptStrategyFactory.createStrategy('planner');
  }

  /**
   * Create execution strategy for the agent using composition
   */
  protected createExecutionStrategy(): IExecutionStrategy {
    return new LLMOnlyExecutionStrategy(); // Planner doesn't use ReAct, just direct LLM calls
  }
  
  /**
   * Get the agent name for logging
   */
  protected getAgentName(): string {
    return 'PlannerAgent';
  }

  /**
   * Execute planning using composition
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<PlannerOutput> {
    profileStart('PlannerAgent.executeAgent');
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
    
      // Detect if this is a follow-up task
      const isFollowUp = input.context?.previousPlan !== undefined && 
                        input.context.previousPlan !== null;
      
      this.log('📋 Planning context', 'info', {
        task: input.instruction,
        isFollowUp,
        hasValidationFeedback: !!input.context?.validationResult,
        previousPlanLength: (input.context?.previousPlan as string[])?.length || 0
      });
      
      // 1. Add system prompt to message history
      this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      this.systemPromptAdded = true;
      
      // Enhance instruction with browser context
      profileStart('PlannerAgent.enhanceInstruction');
      const enhancedInstruction = await this.enhanceInstructionWithContext(input.instruction);
      profileEnd('PlannerAgent.enhanceInstruction');
      
      // Send progress update via EventBus
      this.currentEventBus?.emitSystemMessage(isFollowUp ? '📝 Creating follow-up task plan' : '📝 Creating task plan', 'info', this.getAgentName());
      
      try {
        // Get message history without browser state
        const messages = this.executionContext.messageManager.getMessagesWithoutBrowserState();
        
        // Get detailed browser state
        profileStart('PlannerAgent.getBrowserState');
        const browserStateDescription = await this.browserContext.getBrowserStateString();
        const fullBrowserState = await this.browserContext.getBrowserState();
        profileEnd('PlannerAgent.getBrowserState');
        
        // Extract validation feedback if replanning after validation failure
        const validationResult = input.context?.validationResult as any;
        const validationFeedback = validationResult?.suggestions?.join(', ') || 
                                  validationResult?.reasoning || '';
        
        // Extract previous plan from context (for follow-up tasks)
        const previousPlan = input.context?.previousPlan as string[] | undefined;
        
        // Debug: Log validation context if present
        if (validationResult) {
          this.log('🔄 Replanning after validation', 'info', {
            validationPassed: validationResult.is_valid,
            suggestions: validationResult.suggestions,
            confidence: validationResult.confidence
          });
        }
        
        // Generate plan using LLM with follow-up awareness
        profileStart('PlannerAgent.generatePlanWithLLM');
        const plan = await this.generatePlanWithLLM(
          messages,
          5,  // Default to 5 steps
          enhancedInstruction,
          browserStateDescription,
          validationFeedback,
          previousPlan,
          isFollowUp,
          fullBrowserState.screenshot
        );
        profileEnd('PlannerAgent.generatePlanWithLLM');
      
        // Add the plan to message manager for conversation history
        if (this.executionContext.messageManager && plan.plan.length > 0) {
          this.executionContext.messageManager.addPlanMessage(plan.plan);
        }
        
        // Debug: Log generated plan
        const executionTime = Date.now() - startTime;
        this.log('📦 Plan generated', 'info', {
          stepCount: plan.plan.length,
          complexity: plan.complexity,
          confidence: plan.confidence,
          requiresInteraction: plan.requires_interaction,
          plan: plan.plan,
          executionTime
        });
        
        profileEnd('PlannerAgent.executeAgent');
        return plan;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        profileEnd('PlannerAgent.executeAgent');
        
        return {
          plan: [],
          reasoning: `Planning failed: ${errorMessage}`,
          complexity: 'high' as const,
          estimated_steps: 0,
          requires_interaction: false,
          confidence: 'low' as const
        };
      } finally {
        // 2. Remove system prompt after execution
        if (this.systemPromptAdded) {
          this.executionContext.messageManager.removeSystemMessage();
          this.systemPromptAdded = false;
        }
      }
    } catch (error) {
      profileEnd('PlannerAgent.executeAgent');
      throw error;
    }
  }
  
  // Keep the existing generatePlanWithLLM method but update it to use prompt strategy
  private async generatePlanWithLLM(
    messages: BaseMessage[],
    steps: number,
    task: string,
    browserStateDescription?: string,
    validationFeedback?: string,
    previousPlan?: string[],
    isFollowUp: boolean = false,
    screenshot?: string | null
  ): Promise<PlannerOutput> {
    // Define the output schema for structured response
    const planSchema = z.object({
      plan: z.array(z.string()).describe(`Array of exactly ${steps} next steps`),
      reasoning: z.string().describe('Reasoning behind the plan'),
      complexity: z.enum(['low', 'medium', 'high']).describe('Task complexity assessment'),
      estimated_steps: z.number().describe('Estimated number of steps'),
      requires_interaction: z.boolean().describe('Whether this requires browser interaction'),
      confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in the plan')
    });

    profileStart('PlannerAgent.setupLLM');
    const llm = await this.getLLM();
    const structuredLLM = await withFlexibleStructuredOutput(llm, planSchema);
    profileEnd('PlannerAgent.setupLLM');

    // Use prompt strategy to generate prompts
    const systemPrompt = this.promptStrategy.generateSystemPrompt({ steps, isFollowUp });

    // Build conversation history
    let conversationHistory = 'CONVERSATION HISTORY:\n';
    messages.forEach((msg, index) => {
      const role = msg._getType() === 'human' ? 'User' : 'Assistant';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      conversationHistory += `\n[${index + 1}] ${role}: ${content}\n`;
    });

    // Use prompt strategy to generate user prompt
    const userPrompt = this.promptStrategy.generateUserPrompt(task, {
      conversationHistory,
      browserStateDescription: browserStateDescription || '',
      steps,
      validationFeedback,
      isFollowUp,
      previousPlan
    });

    try {
      this.log('🤖 Invoking LLM for planning', 'info', {
        requestedSteps: steps,
        isFollowUp,
        hasValidationFeedback: !!validationFeedback,
        hasScreenshot: !!screenshot,
        promptLength: userPrompt.length
      });
      
      // Create message based on screenshot availability
      let userMessage: HumanMessage;
      if (screenshot) {
        userMessage = new HumanMessage({
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${screenshot}` }
            }
          ]
        });
      } else {
        userMessage = new HumanMessage(userPrompt);
      }
      
      profileStart('PlannerAgent.llmInvoke');
      const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        userMessage
      ]);
      profileEnd('PlannerAgent.llmInvoke');

      // Ensure we don't exceed the requested number of steps
      if (result.plan.length > steps) {
        result.plan = result.plan.slice(0, steps);
        
        this.log('✏️ Plan truncated', 'info', {
          originalLength: result.plan.length,
          truncatedTo: steps
        });
      }
      
      return result as PlannerOutput;
    } catch (error) {
      return {
        plan: [task],
        reasoning: `Planning failed: ${error instanceof Error ? error.message : String(error)}`,
        complexity: 'high' as const,
        estimated_steps: 0,
        requires_interaction: false,
        confidence: 'low' as const
      };
    }
  }
}
