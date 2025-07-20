/**
 * Dependency Injection Container for managing services and their lifecycles
 * Provides singleton management, factory functions, and circular dependency detection
 */

export type ServiceFactory<T> = () => T | Promise<T>;
export type ServiceToken = string | symbol;

interface ServiceRegistration<T> {
  instance?: T;
  factory?: ServiceFactory<T>;
  singleton: boolean;
  dependencies?: ServiceToken[];
}

export class DIContainer {
  private services = new Map<ServiceToken, ServiceRegistration<any>>();
  private resolutionStack = new Set<ServiceToken>();
  
  /**
   * Register a singleton instance
   */
  register<T>(token: ServiceToken, instance: T): void {
    this.services.set(token, {
      instance,
      singleton: true
    });
  }
  
  /**
   * Register a factory function for creating instances
   */
  registerFactory<T>(
    token: ServiceToken, 
    factory: ServiceFactory<T>, 
    singleton = true,
    dependencies: ServiceToken[] = []
  ): void {
    this.services.set(token, {
      factory,
      singleton,
      dependencies
    });
  }
  
  /**
   * Register a transient service (new instance every time)
   */
  registerTransient<T>(token: ServiceToken, factory: ServiceFactory<T>): void {
    this.registerFactory(token, factory, false);
  }
  
  /**
   * Resolve a service by token
   */
  async resolve<T>(token: ServiceToken): Promise<T> {
    // Check for circular dependencies
    if (this.resolutionStack.has(token)) {
      throw new Error(`Circular dependency detected: ${String(token)}`);
    }
    
    const registration = this.services.get(token);
    if (!registration) {
      throw new Error(`Service not found: ${String(token)}`);
    }
    
    // Return existing singleton instance
    if (registration.singleton && registration.instance) {
      return registration.instance;
    }
    
    // Create new instance
    if (registration.factory) {
      this.resolutionStack.add(token);
      
      try {
        // Resolve dependencies first
        const dependencies: any[] = [];
        if (registration.dependencies) {
          for (const dep of registration.dependencies) {
            dependencies.push(await this.resolve(dep));
          }
        }
        
        const instance = await registration.factory();
        
        // Cache singleton
        if (registration.singleton) {
          registration.instance = instance;
        }
        
        return instance;
      } finally {
        this.resolutionStack.delete(token);
      }
    }
    
    throw new Error(`No factory or instance available for: ${String(token)}`);
  }
  
  /**
   * Resolve synchronously (only works for already instantiated singletons)
   */
  resolveSync<T>(token: ServiceToken): T {
    const registration = this.services.get(token);
    if (!registration?.instance) {
      throw new Error(`Synchronous resolution failed for: ${String(token)}`);
    }
    return registration.instance;
  }
  
  /**
   * Check if a service is registered
   */
  has(token: ServiceToken): boolean {
    return this.services.has(token);
  }
  
  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.resolutionStack.clear();
  }
  
  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): ServiceToken[] {
    return Array.from(this.services.keys());
  }
}

/**
 * Service tokens for commonly used services
 */
export const TOKENS = {
  // Core services
  EXECUTION_CONTEXT: Symbol('ExecutionContext'),
  BROWSER_CONTEXT: Symbol('BrowserContext'),
  EVENT_BUS: Symbol('EventBus'),
  CONFIG_MANAGER: Symbol('ConfigManager'),
  ERROR_HANDLER: Symbol('ErrorHandler'),
  RESOURCE_POOL: Symbol('ResourcePool'),
  
  // Pipeline services
  EXECUTION_PIPELINE: Symbol('ExecutionPipeline'),
  LLM_PROVIDER: Symbol('LLMProvider'),
  MESSAGE_MANAGER: Symbol('MessageManager'),
  
  // Tool services
  TOOL_REGISTRY: Symbol('ToolRegistry'),
  BROWSER_NAVIGATION_PLUGIN: Symbol('BrowserNavigationPlugin'),
  PRODUCTIVITY_PLUGIN: Symbol('ProductivityPlugin'),
  ANSWER_PLUGIN: Symbol('AnswerPlugin'),
  
  // Agent services
  CLASSIFICATION_AGENT: Symbol('ClassificationAgent'),
  PLANNER_AGENT: Symbol('PlannerAgent'),
  BROWSE_AGENT: Symbol('BrowseAgent'),
  PRODUCTIVITY_AGENT: Symbol('ProductivityAgent'),
  VALIDATOR_AGENT: Symbol('ValidatorAgent'),
  ANSWER_AGENT: Symbol('AnswerAgent'),
} as const;
