/**
 * Composable Agent System
 * 
 * Provides a flexible architecture for creating agents with different capability combinations
 */

import { BaseComponent } from '../../core/interfaces';
import { DIContainer } from '../../core/DIContainer';
import { EventBus } from '../../events/EventBus';
import { 
  AgentCapability, 
  AgentCapabilityRegistry, 
  CapabilityExecutor,
  AgentCapabilityRequest,
  AgentCapabilityResponse,
  AgentCapabilityContext
} from './AgentCapability';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  type: string;
  payload: any;
  priority?: number;
  timeout?: number;
  retryCount?: number;
  context?: Record<string, any>;
}

export interface AgentTaskResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  capabilityUsed?: string;
  metadata?: Record<string, any>;
}

export interface AgentSession {
  id: string;
  agentId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  context: Record<string, any>;
  taskHistory: AgentTaskResult[];
}

/**
 * Base composable agent that can be configured with different capabilities
 */
export class ComposableAgent extends BaseComponent {
  private config: AgentConfig;
  private capabilityExecutor: CapabilityExecutor;
  private capabilityRegistry: AgentCapabilityRegistry;
  private eventBus: EventBus;
  private currentSession?: AgentSession;
  private taskQueue: AgentTask[] = [];
  private isProcessing = false;

  constructor(
    config: AgentConfig,
    container: DIContainer
  ) {
    super(`agent.${config.id}`, container.get('logger'));
    this.config = config;
    this.capabilityExecutor = container.get('capabilityExecutor');
    this.capabilityRegistry = container.get('capabilityRegistry');
    this.eventBus = container.get('eventBus');
  }

  /**
   * Get agent metadata
   */
  get metadata() {
    return {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description,
      capabilities: this.config.capabilities,
      state: this.state,
      currentSession: this.currentSession?.id,
      queueSize: this.taskQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Start a new session
   */
  async startSession(userId?: string, context: Record<string, any> = {}): Promise<string> {
    if (this.currentSession && !this.currentSession.endTime) {
      await this.endSession();
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      agentId: this.config.id,
      userId,
      startTime: Date.now(),
      context: { ...context },
      taskHistory: []
    };

    this.eventBus.emit('agent.session.started', {
      agentId: this.config.id,
      sessionId,
      userId
    });

    this.logger.info(`Started session: ${sessionId}`);
    return sessionId;
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.endTime = Date.now();
    
    this.eventBus.emit('agent.session.ended', {
      agentId: this.config.id,
      session: this.currentSession
    });

    this.logger.info(`Ended session: ${this.currentSession.id}`);
    this.currentSession = undefined;
  }

  /**
   * Execute a task using the agent's capabilities
   */
  async executeTask(task: AgentTask): Promise<AgentTaskResult> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }

    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing task: ${task.id} (${task.type})`);
      
      // Create capability request
      const request: AgentCapabilityRequest = {
        id: `req_${task.id}`,
        type: task.type,
        payload: task.payload,
        context: this.createCapabilityContext(task),
        timestamp: Date.now(),
        priority: task.priority
      };

      // Execute using capability system
      const response = await this.capabilityExecutor.execute(request);
      
      const result: AgentTaskResult = {
        taskId: task.id,
        success: response.result.success,
        data: response.result.data,
        error: response.result.error,
        duration: Date.now() - startTime,
        metadata: response.result.metadata
      };

      // Add to session history
      this.currentSession.taskHistory.push(result);

      this.eventBus.emit('agent.task.completed', {
        agentId: this.config.id,
        sessionId: this.currentSession.id,
        task,
        result
      });

      return result;
    } catch (error) {
      const result: AgentTaskResult = {
        taskId: task.id,
        success: false,
        error: error as Error,
        duration: Date.now() - startTime
      };

      this.currentSession.taskHistory.push(result);

      this.eventBus.emit('agent.task.failed', {
        agentId: this.config.id,
        sessionId: this.currentSession.id,
        task,
        result,
        error
      });

      return result;
    }
  }

  /**
   * Queue a task for execution
   */
  queueTask(task: AgentTask): void {
    this.taskQueue.push(task);
    this.eventBus.emit('agent.task.queued', {
      agentId: this.config.id,
      task
    });
    
    // Start processing if not already running
    this.processQueue();
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      while (this.taskQueue.length > 0) {
        // Sort by priority (higher first)
        this.taskQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        const task = this.taskQueue.shift()!;
        await this.executeTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get available capabilities
   */
  getCapabilities(): string[] {
    return [...this.config.capabilities];
  }

  /**
   * Check if agent has a specific capability
   */
  hasCapability(capabilityName: string): boolean {
    return this.config.capabilities.includes(capabilityName);
  }

  /**
   * Add a capability to the agent
   */
  addCapability(capabilityName: string): void {
    if (!this.hasCapability(capabilityName)) {
      this.config.capabilities.push(capabilityName);
      this.eventBus.emit('agent.capability.added', {
        agentId: this.config.id,
        capability: capabilityName
      });
    }
  }

  /**
   * Remove a capability from the agent
   */
  removeCapability(capabilityName: string): void {
    const index = this.config.capabilities.indexOf(capabilityName);
    if (index > -1) {
      this.config.capabilities.splice(index, 1);
      this.eventBus.emit('agent.capability.removed', {
        agentId: this.config.id,
        capability: capabilityName
      });
    }
  }

  /**
   * Get session information
   */
  getSession(): AgentSession | undefined {
    return this.currentSession;
  }

  /**
   * Get task history for current session
   */
  getTaskHistory(): AgentTaskResult[] {
    return this.currentSession?.taskHistory || [];
  }

  /**
   * Update session context
   */
  updateSessionContext(updates: Record<string, any>): void {
    if (this.currentSession) {
      Object.assign(this.currentSession.context, updates);
    }
  }

  /**
   * Create capability context from task
   */
  private createCapabilityContext(task: AgentTask): AgentCapabilityContext {
    return {
      agentId: this.config.id,
      sessionId: this.currentSession!.id,
      userId: this.currentSession!.userId,
      metadata: {
        ...this.currentSession!.context,
        ...task.context,
        taskId: task.id,
        agentName: this.config.name
      }
    };
  }

  protected async doInitialize(): Promise<void> {
    this.logger.info(`Initializing composable agent: ${this.config.name}`);
    
    // Verify all required capabilities are available
    for (const capabilityName of this.config.capabilities) {
      const capability = this.capabilityRegistry.getCapability(capabilityName);
      if (!capability) {
        throw new Error(`Required capability not found: ${capabilityName}`);
      }
    }
  }

  protected async doCleanup(): Promise<void> {
    this.logger.info(`Cleaning up composable agent: ${this.config.name}`);
    
    // End any active session
    if (this.currentSession) {
      await this.endSession();
    }
    
    // Clear task queue
    this.taskQueue = [];
  }
}

/**
 * Agent factory for creating specialized agents
 */
export class AgentFactory extends BaseComponent {
  private container: DIContainer;
  private agentRegistry = new Map<string, ComposableAgent>();

  constructor(container: DIContainer) {
    super('agent.factory', container.get('logger'));
    this.container = container;
  }

  /**
   * Create a web browsing agent
   */
  createWebAgent(id: string, name: string = 'Web Agent'): ComposableAgent {
    const config: AgentConfig = {
      id,
      name,
      description: 'Agent specialized in web browsing and content analysis',
      capabilities: ['webNavigation', 'contentAnalysis'],
      settings: {
        browserSettings: {
          headless: false,
          timeout: 30000
        }
      }
    };

    return this.createAgent(config);
  }

  /**
   * Create a planning agent
   */
  createPlanningAgent(id: string, name: string = 'Planning Agent'): ComposableAgent {
    const config: AgentConfig = {
      id,
      name,
      description: 'Agent specialized in task planning and decomposition',
      capabilities: ['taskPlanning', 'contentAnalysis'],
      settings: {
        planningSettings: {
          maxSteps: 20,
          allowParallel: true
        }
      }
    };

    return this.createAgent(config);
  }

  /**
   * Create a general-purpose agent
   */
  createGeneralAgent(id: string, name: string = 'General Agent'): ComposableAgent {
    const config: AgentConfig = {
      id,
      name,
      description: 'General-purpose agent with multiple capabilities',
      capabilities: ['webNavigation', 'contentAnalysis', 'taskPlanning'],
      settings: {}
    };

    return this.createAgent(config);
  }

  /**
   * Create a custom agent with specific configuration
   */
  createCustomAgent(config: AgentConfig): ComposableAgent {
    return this.createAgent(config);
  }

  /**
   * Create an agent from configuration
   */
  private createAgent(config: AgentConfig): ComposableAgent {
    const agent = new ComposableAgent(config, this.container);
    this.agentRegistry.set(config.id, agent);
    
    this.logger.info(`Created agent: ${config.name} (${config.id})`);
    return agent;
  }

  /**
   * Get an existing agent
   */
  getAgent(id: string): ComposableAgent | undefined {
    return this.agentRegistry.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Map<string, ComposableAgent> {
    return new Map(this.agentRegistry);
  }

  /**
   * Remove an agent
   */
  async removeAgent(id: string): Promise<void> {
    const agent = this.agentRegistry.get(id);
    if (agent) {
      await agent.cleanup();
      this.agentRegistry.delete(id);
      this.logger.info(`Removed agent: ${id}`);
    }
  }

  protected async doInitialize(): Promise<void> {
    this.logger.info('Initializing agent factory');
  }

  protected async doCleanup(): Promise<void> {
    this.logger.info('Cleaning up agent factory');
    
    // Cleanup all agents
    for (const [id, agent] of this.agentRegistry) {
      await agent.cleanup();
    }
    this.agentRegistry.clear();
  }
}
