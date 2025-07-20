/**
 * Agent Capability System
 * 
 * Provides a composable architecture for agent capabilities that can be mixed and matched
 * to create specialized agents with specific skill sets.
 */

import { BaseComponent, ComponentState } from '../../core/interfaces';
import { DIContainer } from '../../core/DIContainer';
import { EventBus } from '../../events/EventBus';
import { ErrorHandler } from '../../core/ErrorHandler';

export interface AgentCapabilityConfig {
  name: string;
  version: string;
  dependencies?: string[];
  priority?: number;
  enabled?: boolean;
  settings?: Record<string, any>;
}

export interface AgentCapabilityContext {
  agentId: string;
  sessionId: string;
  userId?: string;
  metadata: Record<string, any>;
}

export interface AgentCapabilityResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: Record<string, any>;
  duration?: number;
}

export interface AgentCapabilityRequest<T = any> {
  id: string;
  type: string;
  payload: T;
  context: AgentCapabilityContext;
  timestamp: number;
  priority?: number;
}

export interface AgentCapabilityResponse<T = any> {
  requestId: string;
  result: AgentCapabilityResult<T>;
  timestamp: number;
}

/**
 * Base class for all agent capabilities
 */
export abstract class AgentCapability<TConfig extends AgentCapabilityConfig = AgentCapabilityConfig> 
  extends BaseComponent {
  
  protected config: TConfig;
  protected container: DIContainer;
  protected eventBus: EventBus;
  protected errorHandler: ErrorHandler;
  private _enabled: boolean = true;
  private _priority: number = 0;

  constructor(
    config: TConfig,
    container: DIContainer
  ) {
    super(`capability.${config.name}`, container.get('logger'));
    this.config = config;
    this.container = container;
    this.eventBus = container.get('eventBus');
    this.errorHandler = container.get('errorHandler');
    this._enabled = config.enabled ?? true;
    this._priority = config.priority ?? 0;
  }

  /**
   * Get capability metadata
   */
  get metadata() {
    return {
      name: this.config.name,
      version: this.config.version,
      enabled: this._enabled,
      priority: this._priority,
      dependencies: this.config.dependencies || [],
      state: this.state
    };
  }

  /**
   * Enable/disable this capability
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.eventBus.emit('capability.enabled.changed', {
      capability: this.config.name,
      enabled
    });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get priority(): number {
    return this._priority;
  }

  /**
   * Check if this capability can handle a specific request
   */
  abstract canHandle(request: AgentCapabilityRequest): boolean;

  /**
   * Execute the capability
   */
  abstract execute<T = any, R = any>(
    request: AgentCapabilityRequest<T>
  ): Promise<AgentCapabilityResponse<R>>;

  /**
   * Validate capability configuration
   */
  protected validateConfig(): void {
    if (!this.config.name) {
      throw new Error('Capability name is required');
    }
    if (!this.config.version) {
      throw new Error('Capability version is required');
    }
  }

  /**
   * Initialize the capability
   */
  protected async doInitialize(): Promise<void> {
    this.validateConfig();
    this.logger.info(`Initializing capability: ${this.config.name}`);
    
    // Check dependencies
    if (this.config.dependencies) {
      for (const dep of this.config.dependencies) {
        if (!this.container.has(dep)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }
    }

    await this.initializeCapability();
  }

  /**
   * Cleanup the capability
   */
  protected async doCleanup(): Promise<void> {
    this.logger.info(`Cleaning up capability: ${this.config.name}`);
    await this.cleanupCapability();
  }

  /**
   * Override in subclasses for custom initialization
   */
  protected async initializeCapability(): Promise<void> {
    // Default implementation
  }

  /**
   * Override in subclasses for custom cleanup
   */
  protected async cleanupCapability(): Promise<void> {
    // Default implementation
  }

  /**
   * Create a standardized response
   */
  protected createResponse<T>(
    requestId: string,
    result: AgentCapabilityResult<T>
  ): AgentCapabilityResponse<T> {
    return {
      requestId,
      result,
      timestamp: Date.now()
    };
  }

  /**
   * Create a success response
   */
  protected createSuccessResponse<T>(
    requestId: string,
    data: T,
    metadata?: Record<string, any>
  ): AgentCapabilityResponse<T> {
    return this.createResponse(requestId, {
      success: true,
      data,
      metadata
    });
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(
    requestId: string,
    error: Error,
    metadata?: Record<string, any>
  ): AgentCapabilityResponse<never> {
    return this.createResponse(requestId, {
      success: false,
      error,
      metadata
    });
  }
}

/**
 * Registry for managing agent capabilities
 */
export class AgentCapabilityRegistry extends BaseComponent {
  private capabilities = new Map<string, AgentCapability>();
  private capabilityInstances = new Map<string, AgentCapability>();
  private dependencyGraph = new Map<string, Set<string>>();

  constructor(
    private container: DIContainer
  ) {
    super('capability.registry', container.get('logger'));
  }

  /**
   * Register a capability class
   */
  registerCapabilityClass<T extends AgentCapability>(
    name: string,
    capabilityClass: new (config: any, container: DIContainer) => T
  ): void {
    this.container.registerFactory(
      `capability.${name}`,
      (container) => {
        const config = container.get('configManager').getConfig(`capabilities.${name}`);
        return new capabilityClass(config, container);
      },
      [`capability.${name}`]
    );

    this.logger.info(`Registered capability class: ${name}`);
  }

  /**
   * Create and register a capability instance
   */
  async createCapability<T extends AgentCapability>(
    name: string,
    config: AgentCapabilityConfig
  ): Promise<T> {
    try {
      const capability = this.container.get<T>(`capability.${name}`);
      await capability.initialize();
      
      this.capabilityInstances.set(name, capability);
      this.buildDependencyGraph(name, config.dependencies || []);
      
      this.logger.info(`Created capability instance: ${name}`);
      return capability;
    } catch (error) {
      this.logger.error(`Failed to create capability ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a capability instance
   */
  getCapability<T extends AgentCapability>(name: string): T | undefined {
    return this.capabilityInstances.get(name) as T;
  }

  /**
   * Get all capability instances
   */
  getAllCapabilities(): Map<string, AgentCapability> {
    return new Map(this.capabilityInstances);
  }

  /**
   * Get capabilities that can handle a specific request
   */
  getCapabilitiesForRequest(request: AgentCapabilityRequest): AgentCapability[] {
    const capabilities: AgentCapability[] = [];
    
    for (const capability of this.capabilityInstances.values()) {
      if (capability.enabled && capability.canHandle(request)) {
        capabilities.push(capability);
      }
    }

    // Sort by priority (higher priority first)
    return capabilities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a capability
   */
  async removeCapability(name: string): Promise<void> {
    const capability = this.capabilityInstances.get(name);
    if (capability) {
      await capability.cleanup();
      this.capabilityInstances.delete(name);
      this.dependencyGraph.delete(name);
      this.logger.info(`Removed capability: ${name}`);
    }
  }

  /**
   * Build dependency graph for capability ordering
   */
  private buildDependencyGraph(name: string, dependencies: string[]): void {
    this.dependencyGraph.set(name, new Set(dependencies));
  }

  /**
   * Get capabilities in dependency order
   */
  getCapabilitiesInDependencyOrder(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }
      if (visited.has(name)) {
        return;
      }

      visiting.add(name);
      const dependencies = this.dependencyGraph.get(name) || new Set();
      
      for (const dep of dependencies) {
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const name of this.capabilityInstances.keys()) {
      visit(name);
    }

    return result;
  }

  protected async doInitialize(): Promise<void> {
    this.logger.info('Initializing capability registry');
  }

  protected async doCleanup(): Promise<void> {
    this.logger.info('Cleaning up capability registry');
    
    // Cleanup all capabilities in reverse dependency order
    const orderedCapabilities = this.getCapabilitiesInDependencyOrder().reverse();
    
    for (const name of orderedCapabilities) {
      await this.removeCapability(name);
    }
  }
}

/**
 * Capability execution engine
 */
export class CapabilityExecutor extends BaseComponent {
  private registry: AgentCapabilityRegistry;
  private eventBus: EventBus;
  private errorHandler: ErrorHandler;

  constructor(container: DIContainer) {
    super('capability.executor', container.get('logger'));
    this.registry = container.get('capabilityRegistry');
    this.eventBus = container.get('eventBus');
    this.errorHandler = container.get('errorHandler');
  }

  /**
   * Execute a request using the best available capability
   */
  async execute<T = any, R = any>(
    request: AgentCapabilityRequest<T>
  ): Promise<AgentCapabilityResponse<R>> {
    const startTime = Date.now();
    
    try {
      this.eventBus.emit('capability.execution.started', { request });
      
      const capabilities = this.registry.getCapabilitiesForRequest(request);
      
      if (capabilities.length === 0) {
        throw new Error(`No capability found to handle request type: ${request.type}`);
      }

      // Use the highest priority capability
      const capability = capabilities[0];
      this.logger.debug(`Executing request ${request.id} with capability: ${capability.metadata.name}`);
      
      const response = await capability.execute<T, R>(request);
      
      // Add execution duration
      if (response.result) {
        response.result.duration = Date.now() - startTime;
      }
      
      this.eventBus.emit('capability.execution.completed', {
        request,
        response,
        capability: capability.metadata.name
      });
      
      return response;
    } catch (error) {
      const errorResponse = {
        requestId: request.id,
        result: {
          success: false,
          error: error as Error,
          duration: Date.now() - startTime
        },
        timestamp: Date.now()
      } as AgentCapabilityResponse<R>;
      
      this.eventBus.emit('capability.execution.failed', {
        request,
        error,
        response: errorResponse
      });
      
      await this.errorHandler.handleError(error as Error, {
        context: 'capability.execution',
        request
      });
      
      return errorResponse;
    }
  }

  /**
   * Execute request with multiple capabilities (parallel or sequential)
   */
  async executeWithMultiple<T = any, R = any>(
    request: AgentCapabilityRequest<T>,
    options: {
      mode: 'parallel' | 'sequential';
      maxCapabilities?: number;
      aggregateResults?: boolean;
    } = { mode: 'sequential' }
  ): Promise<AgentCapabilityResponse<R>[]> {
    const capabilities = this.registry.getCapabilitiesForRequest(request);
    const maxCapabilities = options.maxCapabilities || capabilities.length;
    const selectedCapabilities = capabilities.slice(0, maxCapabilities);

    if (options.mode === 'parallel') {
      const promises = selectedCapabilities.map(cap => cap.execute<T, R>(request));
      return Promise.all(promises);
    } else {
      const results: AgentCapabilityResponse<R>[] = [];
      for (const capability of selectedCapabilities) {
        const result = await capability.execute<T, R>(request);
        results.push(result);
        
        // Stop on first success if not aggregating
        if (!options.aggregateResults && result.result.success) {
          break;
        }
      }
      return results;
    }
  }

  protected async doInitialize(): Promise<void> {
    this.logger.info('Initializing capability executor');
  }

  protected async doCleanup(): Promise<void> {
    this.logger.info('Cleaning up capability executor');
  }
}
