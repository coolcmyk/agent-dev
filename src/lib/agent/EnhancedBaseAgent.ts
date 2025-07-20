/**
 * Enhanced Base Agent
 * 
 * Updated BaseAgent that integrates with the new component architecture,
 * dependency injection, resource pooling, and capability system.
 */

import { z } from "zod";
import { BaseComponent } from '../core/interfaces';
import { DIContainer } from '../core/DIContainer';
import { EventBus } from '../events/EventBus';
import { ResourcePool } from '../core/ResourcePool';
import { 
  ComposableAgent, 
  AgentTask, 
  AgentTaskResult, 
  AgentSession 
} from './core/ComposableAgent';
import { 
  AgentCapability, 
  AgentCapabilityRequest, 
  AgentCapabilityResponse,
  AgentCapabilityContext 
} from './core/AgentCapability';
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";

/**
 * Enhanced Agent Input Schema
 */
export const EnhancedAgentInputSchema = z.object({
  instruction: z.string(),
  context: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
  priority: z.number().optional(),
  timeout: z.number().optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export type EnhancedAgentInput = z.infer<typeof EnhancedAgentInputSchema>;

/**
 * Enhanced Agent Output Schema
 */
export const EnhancedAgentOutputSchema = z.object({
  success: z.boolean(),
  result: z.unknown(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  session: z.object({
    id: z.string(),
    taskCount: z.number(),
    duration: z.number()
  }).optional(),
  capabilities: z.array(z.string()).optional(),
  resourceUsage: z.record(z.unknown()).optional()
});

export type EnhancedAgentOutput = z.infer<typeof EnhancedAgentOutputSchema>;

/**
 * Enhanced Agent Configuration
 */
export interface EnhancedAgentConfig {
  id: string;
  name: string;
  description?: string;
  requiredCapabilities: string[];
  optionalCapabilities?: string[];
  settings: {
    systemPrompt?: string;
    maxIterations?: number;
    timeout?: number;
    retryCount?: number;
    useVision?: boolean;
    debugMode?: boolean;
    resourceLimits?: Record<string, number>;
  };
  metadata?: Record<string, any>;
}

/**
 * Enhanced BaseAgent that integrates with the new architecture
 */
export abstract class EnhancedBaseAgent 
  extends BaseComponent 
  implements Runnable<EnhancedAgentInput, EnhancedAgentOutput> {
  
  protected config: EnhancedAgentConfig;
  protected container: DIContainer;
  protected eventBus: EventBus;
  protected resourcePool: ResourcePool;
  protected composableAgent: ComposableAgent;
  protected llmCache?: BaseChatModel;
  protected conversationHistory: BaseMessage[] = [];

  // LangChain namespace requirement
  lc_namespace = ["nxtscape", "agents", "enhanced"];

  constructor(
    config: EnhancedAgentConfig,
    container: DIContainer
  ) {
    super(`agent.${config.id}`, container.get('logger'));
    this.config = config;
    this.container = container;
    this.eventBus = container.get('eventBus');
    this.resourcePool = container.get('resourcePool');
    
    // Create composable agent instance
    this.composableAgent = new ComposableAgent({
      id: config.id,
      name: config.name,
      description: config.description,
      capabilities: [
        ...config.requiredCapabilities,
        ...(config.optionalCapabilities || [])
      ],
      settings: config.settings,
      metadata: config.metadata
    }, container);
  }

  /**
   * Main execution method - implements Runnable interface
   */
  async invoke(
    input: EnhancedAgentInput,
    config?: RunnableConfig
  ): Promise<EnhancedAgentOutput> {
    const validatedInput = EnhancedAgentInputSchema.parse(input);
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Start or resume session
      let sessionId = validatedInput.sessionId;
      if (!sessionId) {
        sessionId = await this.composableAgent.startSession(
          config?.configurable?.userId as string,
          validatedInput.context || {}
        );
      }

      // Execute using the agent's execution logic
      const result = await this.executeWithCapabilities(validatedInput, config);
      
      const session = this.composableAgent.getSession();
      const duration = Date.now() - startTime;

      // Update resource usage metrics
      await this.updateResourceUsage(duration);

      return {
        success: true,
        result: result.data,
        metadata: {
          ...result.metadata,
          executionTime: duration,
          agentName: this.config.name
        },
        session: session ? {
          id: session.id,
          taskCount: session.taskHistory.length,
          duration
        } : undefined,
        capabilities: this.composableAgent.getCapabilities(),
        resourceUsage: await this.getResourceUsage()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Agent execution failed:`, error);
      
      return {
        success: false,
        result: null,
        error: (error as Error).message,
        metadata: {
          executionTime: duration,
          agentName: this.config.name,
          errorType: error?.constructor.name
        }
      };
    }
  }

  /**
   * Execute using capabilities
   */
  protected async executeWithCapabilities(
    input: EnhancedAgentInput,
    config?: RunnableConfig
  ): Promise<AgentTaskResult> {
    // Create conversation context
    await this.setupConversation(input);
    
    // Determine execution strategy
    const strategy = await this.determineExecutionStrategy(input);
    
    // Execute based on strategy
    switch (strategy.type) {
      case 'single_capability':
        return await this.executeSingleCapability(input, strategy.capability!);
      case 'multi_capability':
        return await this.executeMultiCapability(input, strategy.capabilities!);
      case 'conversation':
        return await this.executeConversation(input);
      default:
        throw new Error(`Unknown execution strategy: ${strategy.type}`);
    }
  }

  /**
   * Execute with a single capability
   */
  protected async executeSingleCapability(
    input: EnhancedAgentInput,
    capabilityName: string
  ): Promise<AgentTaskResult> {
    const task: AgentTask = {
      id: `task_${Date.now()}`,
      type: this.mapInstructionToCapabilityType(input.instruction, capabilityName),
      payload: {
        instruction: input.instruction,
        context: input.context,
        ...this.createCapabilityPayload(input, capabilityName)
      },
      priority: input.priority || 0,
      timeout: input.timeout || this.config.settings.timeout,
      context: input.metadata || {}
    };

    return await this.composableAgent.executeTask(task);
  }

  /**
   * Execute with multiple capabilities
   */
  protected async executeMultiCapability(
    input: EnhancedAgentInput,
    capabilities: string[]
  ): Promise<AgentTaskResult> {
    const results: AgentTaskResult[] = [];
    
    for (const capability of capabilities) {
      try {
        const result = await this.executeSingleCapability(input, capability);
        results.push(result);
        
        // Stop on first success if configured
        if (result.success && !this.config.settings.retryCount) {
          return result;
        }
      } catch (error) {
        results.push({
          taskId: `task_${Date.now()}`,
          success: false,
          error: error as Error,
          duration: 0,
          capabilityUsed: capability
        });
      }
    }

    // Aggregate results
    return this.aggregateResults(results);
  }

  /**
   * Execute as conversation
   */
  protected async executeConversation(
    input: EnhancedAgentInput
  ): Promise<AgentTaskResult> {
    // Get LLM from resource pool
    const llm = await this.getLLM();
    
    // Add user message to conversation
    this.conversationHistory.push(new HumanMessage(input.instruction));
    
    // Generate response
    const response = await llm.invoke(this.conversationHistory);
    
    // Add AI response to conversation
    this.conversationHistory.push(response);
    
    return {
      taskId: `conv_${Date.now()}`,
      success: true,
      data: {
        response: response.content,
        conversationLength: this.conversationHistory.length
      },
      duration: 0
    };
  }

  /**
   * Setup conversation with system prompt and context
   */
  protected async setupConversation(input: EnhancedAgentInput): Promise<void> {
    if (this.conversationHistory.length === 0) {
      // Add system prompt
      const systemPrompt = this.generateSystemPrompt();
      if (systemPrompt) {
        this.conversationHistory.push(new SystemMessage(systemPrompt));
      }
      
      // Add context if provided
      if (input.context) {
        const contextMessage = this.formatContextAsMessage(input.context);
        if (contextMessage) {
          this.conversationHistory.push(contextMessage);
        }
      }
    }
  }

  /**
   * Get LLM instance from resource pool
   */
  protected async getLLM(): Promise<BaseChatModel> {
    if (!this.llmCache) {
      this.llmCache = await this.resourcePool.acquire('llm') as BaseChatModel;
    }
    return this.llmCache;
  }

  /**
   * Determine execution strategy based on input
   */
  protected async determineExecutionStrategy(input: EnhancedAgentInput): Promise<{
    type: 'single_capability' | 'multi_capability' | 'conversation';
    capability?: string;
    capabilities?: string[];
  }> {
    // If specific capabilities requested, use those
    if (input.capabilities && input.capabilities.length > 0) {
      if (input.capabilities.length === 1) {
        return { type: 'single_capability', capability: input.capabilities[0] };
      } else {
        return { type: 'multi_capability', capabilities: input.capabilities };
      }
    }

    // Analyze instruction to determine best capability
    const bestCapability = await this.analyzeInstructionForCapability(input.instruction);
    
    if (bestCapability) {
      return { type: 'single_capability', capability: bestCapability };
    }

    // Default to conversation
    return { type: 'conversation' };
  }

  /**
   * Analyze instruction to determine best capability
   */
  protected async analyzeInstructionForCapability(instruction: string): Promise<string | null> {
    const lowercaseInstruction = instruction.toLowerCase();
    
    // Simple keyword-based analysis (could be enhanced with LLM)
    if (lowercaseInstruction.includes('navigate') || lowercaseInstruction.includes('browse') || lowercaseInstruction.includes('website')) {
      return 'webNavigation';
    }
    
    if (lowercaseInstruction.includes('analyze') || lowercaseInstruction.includes('extract') || lowercaseInstruction.includes('summarize')) {
      return 'contentAnalysis';
    }
    
    if (lowercaseInstruction.includes('plan') || lowercaseInstruction.includes('break down') || lowercaseInstruction.includes('steps')) {
      return 'taskPlanning';
    }
    
    return null;
  }

  /**
   * Map instruction to capability type
   */
  protected mapInstructionToCapabilityType(instruction: string, capability: string): string {
    const lowercaseInstruction = instruction.toLowerCase();
    
    switch (capability) {
      case 'webNavigation':
        if (lowercaseInstruction.includes('click')) return 'web.interact';
        if (lowercaseInstruction.includes('extract')) return 'web.extract';
        return 'web.navigation';
        
      case 'contentAnalysis':
        if (lowercaseInstruction.includes('summarize')) return 'content.summarize';
        if (lowercaseInstruction.includes('extract')) return 'content.extract';
        return 'content.analysis';
        
      case 'taskPlanning':
        return 'task.planning';
        
      default:
        return capability;
    }
  }

  /**
   * Create capability-specific payload
   */
  protected createCapabilityPayload(input: EnhancedAgentInput, capability: string): any {
    // Override in subclasses for capability-specific payloads
    return {};
  }

  /**
   * Aggregate multiple capability results
   */
  protected aggregateResults(results: AgentTaskResult[]): AgentTaskResult {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length > 0) {
      // Return the first successful result, or combine them
      return successfulResults[0];
    }
    
    // All failed - return combined error
    const errors = results.map(r => r.error?.message || 'Unknown error').join('; ');
    return {
      taskId: `aggregated_${Date.now()}`,
      success: false,
      error: new Error(`All capabilities failed: ${errors}`),
      duration: results.reduce((sum, r) => sum + r.duration, 0)
    };
  }

  /**
   * Format context as a message
   */
  protected formatContextAsMessage(context: Record<string, unknown>): BaseMessage | null {
    if (Object.keys(context).length === 0) return null;
    
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
    
    return new SystemMessage(`Context:\n${contextStr}`);
  }

  /**
   * Update resource usage metrics
   */
  protected async updateResourceUsage(duration: number): Promise<void> {
    // Track resource usage for optimization
    this.eventBus.emit('agent.resource.usage', {
      agentId: this.config.id,
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Get current resource usage
   */
  protected async getResourceUsage(): Promise<Record<string, unknown>> {
    return {
      conversationLength: this.conversationHistory.length,
      llmCached: !!this.llmCache,
      sessionActive: !!this.composableAgent.getSession()
    };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract generateSystemPrompt(): string;
  protected abstract getAgentName(): string;

  /**
   * Initialize the enhanced agent
   */
  protected async doInitialize(): Promise<void> {
    this.logger.info(`Initializing enhanced agent: ${this.config.name}`);
    
    // Initialize composable agent
    await this.composableAgent.initialize();
    
    // Verify required capabilities are available
    for (const capability of this.config.requiredCapabilities) {
      if (!this.composableAgent.hasCapability(capability)) {
        throw new Error(`Required capability not available: ${capability}`);
      }
    }
  }

  /**
   * Cleanup the enhanced agent
   */
  protected async doCleanup(): Promise<void> {
    this.logger.info(`Cleaning up enhanced agent: ${this.config.name}`);
    
    // Release LLM back to pool
    if (this.llmCache) {
      await this.resourcePool.release('llm', this.llmCache);
      this.llmCache = undefined;
    }
    
    // Cleanup composable agent
    await this.composableAgent.cleanup();
    
    // Clear conversation history
    this.conversationHistory = [];
  }

  /**
   * Stream method for compatibility (delegates to invoke)
   */
  async stream(
    input: EnhancedAgentInput,
    config?: RunnableConfig
  ): Promise<any> {
    // For now, delegate to invoke
    // Could be enhanced to support streaming in the future
    return this.invoke(input, config);
  }

  /**
   * Transform method for Runnable compatibility
   */
  transform(): any {
    throw new Error('Transform method not implemented for agents');
  }

  /**
   * Batch method for Runnable compatibility
   */
  async batch(
    inputs: EnhancedAgentInput[],
    config?: RunnableConfig
  ): Promise<EnhancedAgentOutput[]> {
    return Promise.all(inputs.map(input => this.invoke(input, config)));
  }
}
