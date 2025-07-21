import { z } from 'zod';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { IToolSet, ToolSetFactory } from './toolsets/ToolSetManager';
import { IPromptStrategy, PromptStrategyFactory } from './prompts/PromptStrategy';
import { IExecutionStrategy, LLMOnlyExecutionStrategy } from './execution/ExecutionStrategy';

// Import message types
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Import structured output utility
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';
import { VISION_CONFIG } from '@/config/visionConfig';

/**
 * Configuration options for validator agent
 */
export const ValidatorAgentOptionsSchema = z.object({
  strictMode: z.boolean().optional()
});

export type ValidatorAgentOptions = z.infer<typeof ValidatorAgentOptionsSchema>;

/**
 * Validator output schema
 */
export const ValidatorOutputSchema = z.object({
  is_valid: z.boolean(),
  reasoning: z.string(),
  answer: z.string(),
  suggestions: z.array(z.string()).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  needs_retry: z.boolean()
});

export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

/**
 * Agent specialized for validating task completion.
 */
export class ValidatorAgent extends BaseAgent {
  private strictMode: boolean;

  constructor(options: AgentOptions & ValidatorAgentOptions) {
    const updatedOptions = {
      ...options,
      useVision: VISION_CONFIG.VALIDATOR_AGENT_USE_VISION
    };
    super(updatedOptions);
    this.strictMode = options.strictMode || false;
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
    return PromptStrategyFactory.createStrategy('validator');
  }

  /**
   * Create execution strategy for the agent using composition
   */
  protected createExecutionStrategy(): IExecutionStrategy {
    return new LLMOnlyExecutionStrategy(); // Validator doesn't use ReAct, just direct LLM calls
  }

  /**
   * Get the agent name for logging
   */
  protected getAgentName(): string {
    return 'ValidatorAgent';
  }

  /**
   * Execute validation using composition
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<ValidatorOutput> {
    await this.ensureInitialized();
    
    // 1. Add system prompt to message history
    this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
    this.systemPromptAdded = true;
    
    // Enhance instruction with browser context
    const enhancedInstruction = await this.enhanceInstructionWithContext(input.instruction);
    
    // Send progress update via EventBus
    this.currentEventBus?.emitThinking('✅ Validating task completion...', 'info', this.getAgentName());
    
    // Determine if vision should be used
    const useVision = VISION_CONFIG.VALIDATOR_TOOL_USE_VISION;
    
    this.log('🔍 Starting validation', 'info', {
      task: input.instruction,
      strictMode: this.strictMode,
      useVision,
      hasContext: !!input.context
    });
    
    try {
      // 2. Add browser state before validation
      if (!this.stateMessageAdded) {
        const browserStateForMessage = await this.browserContext.getBrowserStateString();
        this.executionContext.messageManager.addBrowserStateMessage(browserStateForMessage);
        this.stateMessageAdded = true;
        
        this.log('🌐 Browser state captured for validation', 'info', {
          useVision,
          url: await this.browserContext.getCurrentPage().then(p => p.url()),
          hasScreenshot: useVision
        });
      }
      
      // Get browser state with vision support if enabled
      const browserStateText = await this.browserContext.getBrowserStateString();
      const fullBrowserState = await this.browserContext.getBrowserState();
      
      this.log('🤖 Invoking LLM for validation', 'info', {
        taskLength: enhancedInstruction.length,
        browserStateLength: browserStateText.length,
        hasScreenshot: !!fullBrowserState.screenshot,
        strictMode: this.strictMode
      });
      
      // Validate using LLM
      const validation = await this._validateWithLLM(
        enhancedInstruction,
        browserStateText,
        [],
        false,
        this.strictMode,
        fullBrowserState.screenshot
      );
      
      this.log('🏁 Validation complete', 'info', {
        isValid: validation.is_valid,
        confidence: validation.confidence,
        hasSuggestions: (validation.suggestions?.length || 0) > 0,
        reasoning: validation.reasoning.substring(0, 100) + '...'
      });
      
      // 3. Remove browser state and system prompt after validation
      if (this.stateMessageAdded) {
        this.executionContext.messageManager.removeBrowserStateMessages();
        this.stateMessageAdded = false;
      }
      
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }
      
      return {
        ...validation,
        needs_retry: !validation.is_valid
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
      
      this.log('❌ Validation failed', 'error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (this.currentEventBus) {
        this.currentEventBus.emitSystemMessage(
          `❌ Validation error: ${errorMessage}`, 
          'error', 
          this.getAgentName()
        );
      }
      
      return {
        is_valid: false,
        reasoning: `Validation failed: ${errorMessage}`,
        answer: '',
        suggestions: [],
        confidence: 'low',
        needs_retry: true
      };
    }
  }
  
  /**
   * Validate task completion using LLM with structured output
   */
  private async _validateWithLLM(
    task: string,
    browserStateText: string,
    plan?: string[],
    requireAnswer?: boolean,
    strictMode?: boolean,
    screenshot?: string | null
  ): Promise<ValidatorOutput> {
    // Define the output schema for structured response
    const validationSchema = z.object({
      is_valid: z.boolean().describe('Whether the task was completed successfully'),
      reasoning: z.string().describe('Detailed explanation of the validation result'),
      answer: z.string().describe('The final answer extracted from the conversation if applicable, empty string otherwise'),
      suggestions: z.array(z.string()).optional().describe('Suggestions for improvement if task is not complete'),
      confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level in the validation')
    });

    // Get LLM using base agent method
    const llm = await this.getLLM();
    
    // Create LLM with structured output
    const structuredLLM = await withFlexibleStructuredOutput(llm, validationSchema);

    // Use prompt strategy to generate prompts
    const systemPrompt = this.promptStrategy.generateSystemPrompt({ strictMode });
    const userPrompt = this.promptStrategy.generateUserPrompt(task, { 
      browserStateText, 
      plan, 
      requireAnswer, 
      strictMode 
    });

    try {
      // Create message based on vision availability
      let userMessage: HumanMessage;

      if (VISION_CONFIG.VALIDATOR_TOOL_USE_VISION && screenshot) {
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

      // Get structured response from LLM
      const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        userMessage
      ]);

      // Ensure answer field is present
      if (!result.answer) {
        result.answer = '';
      }

      return result as ValidatorOutput;
    } catch (error) {
      return {
        is_valid: false,
        reasoning: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        answer: '',
        confidence: 'low',
        needs_retry: true
      };
    }
  }
}
