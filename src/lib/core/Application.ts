import { DIContainer, TOKENS } from './DIContainer';
import { ConfigManager, CONFIG_KEYS } from './ConfigManager';
import { ResourcePoolManager, ResourcePool } from './ResourcePool';
import { ErrorHandler, ConsoleErrorReporter } from './ErrorHandler';
import { BaseComponent } from './interfaces';
import { ExecutionContext } from '../runtime/ExecutionContext';
import { BrowserContext } from '../browser/BrowserContext';
import { LangChainProviderFactory } from '../llm/LangChainProviderFactory';
import { StreamEventBus } from '../events/StreamEventBus';
import MessageManager from '../runtime/MessageManager';
import { z } from 'zod';

/**
 * Application configuration schema
 */
const ApplicationConfigSchema = z.object({
  debugMode: z.boolean().default(false),
  maxConcurrency: z.number().default(3),
  resourcePoolSizes: z.object({
    llm: z.number().default(3),
    browserPages: z.number().default(5),
  }).default({}),
  cacheSettings: z.object({
    browserStateTTL: z.number().default(3000),
    llmCacheTTL: z.number().default(300000),
  }).default({}),
});

type ApplicationConfig = z.infer<typeof ApplicationConfigSchema>;

/**
 * Main application bootstrap class
 * Orchestrates dependency injection, configuration, and service initialization
 */
export class NxtscapeApplication extends BaseComponent {
  private container: DIContainer;
  private configManager: ConfigManager;
  private resourcePoolManager: ResourcePoolManager;
  private errorHandler: ErrorHandler;
  
  constructor() {
    super();
    this.container = new DIContainer();
  }
  
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    this.log('🚀 Initializing NxtScape Application');
    
    try {
      // Initialize core services first
      await this.setupCoreServices();
      
      // Setup dependency injection
      await this.setupDependencyInjection();
      
      // Initialize resource pools
      await this.setupResourcePools();
      
      // Register default configurations
      await this.setupDefaultConfigurations();
      
      this._isInitialized = true;
      this.log('✅ NxtScape Application initialized successfully');
      
    } catch (error) {
      this.log('❌ Failed to initialize NxtScape Application:', 'error', error);
      throw error;
    }
  }
  
  async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up NxtScape Application');
    
    try {
      // Cleanup in reverse order of initialization
      await Promise.all([
        this.resourcePoolManager?.cleanup(),
        this.errorHandler?.cleanup(),
        this.configManager?.cleanup(),
      ]);
      
      this.container.clear();
      this.log('✅ NxtScape Application cleaned up successfully');
      
    } catch (error) {
      this.log('❌ Error during cleanup:', 'error', error);
    }
  }
  
  /**
   * Get the dependency injection container
   */
  getContainer(): DIContainer {
    return this.container;
  }
  
  /**
   * Get the configuration manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }
  
  /**
   * Get the resource pool manager
   */
  getResourcePoolManager(): ResourcePoolManager {
    return this.resourcePoolManager;
  }
  
  /**
   * Create an orchestrator instance
   */
  async createOrchestrator(): Promise<any> {
    await this.ensureInitialized();
    
    const executionContext = await this.container.resolve<ExecutionContext>(TOKENS.EXECUTION_CONTEXT);
    
    // Import orchestrator dynamically to avoid circular dependencies
    const { Orchestrator } = await import('../orchestrators/Orchestrator');
    return new Orchestrator(executionContext);
  }
  
  /**
   * Create an execution context with all dependencies
   */
  async createExecutionContext(options: {
    debugMode?: boolean;
    abortController?: AbortController;
  } = {}): Promise<ExecutionContext> {
    await this.ensureInitialized();
    
    const browserContext = await this.container.resolve<BrowserContext>(TOKENS.BROWSER_CONTEXT);
    const messageManager = await this.container.resolve<MessageManager>(TOKENS.MESSAGE_MANAGER);
    const eventBus = await this.container.resolve<StreamEventBus>(TOKENS.EVENT_BUS);
    
    const { ExecutionContext } = await import('../runtime/ExecutionContext');
    
    return new ExecutionContext({
      browserContext,
      messageManager,
      abortController: options.abortController || new AbortController(),
      debugMode: options.debugMode || false,
      eventBus,
    });
  }
  
  private async setupCoreServices(): Promise<void> {
    // Configuration Manager
    this.configManager = new ConfigManager();
    await this.configManager.initialize();
    this.container.register(TOKENS.CONFIG_MANAGER, this.configManager);
    
    // Resource Pool Manager
    this.resourcePoolManager = new ResourcePoolManager();
    await this.resourcePoolManager.initialize();
    this.container.register(TOKENS.RESOURCE_POOL, this.resourcePoolManager);
    
    // Error Handler
    this.errorHandler = new ErrorHandler();
    await this.errorHandler.initialize();
    this.errorHandler.addReporter(new ConsoleErrorReporter());
    this.container.register(TOKENS.ERROR_HANDLER, this.errorHandler);
  }
  
  private async setupDependencyInjection(): Promise<void> {
    // Register factory for EventBus
    this.container.registerFactory(TOKENS.EVENT_BUS, async () => {
      const { StreamEventBus } = await import('../events/StreamEventBus');
      const eventBus = new StreamEventBus();
      
      // Add error reporter that sends to event bus
      const { EventBusErrorReporter } = await import('./ErrorHandler');
      this.errorHandler.addReporter(new EventBusErrorReporter(eventBus));
      
      return eventBus;
    });
    
    // Register factory for BrowserContext
    this.container.registerFactory(TOKENS.BROWSER_CONTEXT, async () => {
      const { BrowserContext } = await import('../browser/BrowserContext');
      const config = this.configManager.getConfig(CONFIG_KEYS.BROWSER_CONTEXT);
      return new BrowserContext(config);
    });
    
    // Register factory for MessageManager
    this.container.registerFactory(TOKENS.MESSAGE_MANAGER, async () => {
      const { default: MessageManager } = await import('../runtime/MessageManager');
      return new MessageManager();
    });
    
    // Register factory for ExecutionContext
    this.container.registerFactory(TOKENS.EXECUTION_CONTEXT, async () => {
      const browserContext = await this.container.resolve<BrowserContext>(TOKENS.BROWSER_CONTEXT);
      const messageManager = await this.container.resolve<MessageManager>(TOKENS.MESSAGE_MANAGER);
      const eventBus = await this.container.resolve<StreamEventBus>(TOKENS.EVENT_BUS);
      
      const { ExecutionContext } = await import('../runtime/ExecutionContext');
      return new ExecutionContext({
        browserContext,
        messageManager,
        abortController: new AbortController(),
        debugMode: this.configManager.getConfig(CONFIG_KEYS.DEBUGGING).enabled || false,
        eventBus,
      });
    });
    
    // Register factory for LLM Provider
    this.container.registerFactory(TOKENS.LLM_PROVIDER, async () => {
      return LangChainProviderFactory.createLLM();
    }, false); // Not singleton - create fresh instances
  }
  
  private async setupResourcePools(): Promise<void> {
    const config = this.configManager.getConfig(CONFIG_KEYS.PERFORMANCE);
    
    // LLM Resource Pool
    const llmPool = new ResourcePool(
      config.resourcePoolSizes.llm,
      () => LangChainProviderFactory.createLLM(),
      async (llm) => {
        // LLM cleanup if needed
      },
      async (llm) => {
        // LLM validation - check if still functional
        return true; // Implement actual validation if needed
      }
    );
    
    this.resourcePoolManager.registerPool('llm', llmPool);
    
    this.log(`Setup resource pools - LLM: ${config.resourcePoolSizes.llm}`);
  }
  
  private async setupDefaultConfigurations(): Promise<void> {
    // Application config
    this.configManager.registerConfig(
      'application',
      {
        debugMode: false,
        maxConcurrency: 3,
        resourcePoolSizes: { llm: 3, browserPages: 5 },
        cacheSettings: { browserStateTTL: 3000, llmCacheTTL: 300000 },
      },
      ApplicationConfigSchema
    );
    
    // Browser context config
    this.configManager.registerConfig(
      CONFIG_KEYS.BROWSER_CONTEXT,
      {
        maximumWaitPageLoadTime: 5.0,
        waitBetweenActions: 0.1,
        homePageUrl: 'https://www.google.com',
        useVision: false,
      },
      z.object({
        maximumWaitPageLoadTime: z.number().default(5.0),
        waitBetweenActions: z.number().default(0.1),
        homePageUrl: z.string().default('https://www.google.com'),
        useVision: z.boolean().default(false),
      })
    );
    
    // Performance config
    this.configManager.registerConfig(
      CONFIG_KEYS.PERFORMANCE,
      {
        resourcePoolSizes: { llm: 3, browserPages: 5 },
        cacheSettings: { browserStateTTL: 3000, llmCacheTTL: 300000 },
        parallelization: { maxConcurrency: 3, enableBatching: true },
      },
      z.object({
        resourcePoolSizes: z.object({
          llm: z.number().default(3),
          browserPages: z.number().default(5),
        }).default({}),
        cacheSettings: z.object({
          browserStateTTL: z.number().default(3000),
          llmCacheTTL: z.number().default(300000),
        }).default({}),
        parallelization: z.object({
          maxConcurrency: z.number().default(3),
          enableBatching: z.boolean().default(true),
        }).default({}),
      })
    );
    
    // Debugging config
    this.configManager.registerConfig(
      CONFIG_KEYS.DEBUGGING,
      {
        enabled: false,
        logLevel: 'info',
        enableProfiling: false,
        verboseLogging: false,
      },
      z.object({
        enabled: z.boolean().default(false),
        logLevel: z.enum(['error', 'warning', 'info', 'debug']).default('info'),
        enableProfiling: z.boolean().default(false),
        verboseLogging: z.boolean().default(false),
      })
    );
    
    this.log('Default configurations registered');
  }
}

// Global application instance
let applicationInstance: NxtscapeApplication | null = null;

/**
 * Get the global application instance
 */
export function getApplication(): NxtscapeApplication {
  if (!applicationInstance) {
    applicationInstance = new NxtscapeApplication();
  }
  return applicationInstance;
}

/**
 * Initialize the global application
 */
export async function initializeApplication(): Promise<NxtscapeApplication> {
  const app = getApplication();
  if (!app.isInitialized()) {
    await app.initialize();
  }
  return app;
}

/**
 * Cleanup the global application
 */
export async function cleanupApplication(): Promise<void> {
  if (applicationInstance) {
    await applicationInstance.cleanup();
    applicationInstance = null;
  }
}
