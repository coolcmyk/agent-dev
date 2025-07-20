/**
 * Core Architecture Index
 * 
 * Exports all the new component architecture, dependency injection,
 * resource pooling, and capability system components.
 */

// Core Infrastructure
export * from './core/interfaces';
export * from './core/DIContainer';
export * from './core/ConfigManager';
export * from './core/ResourcePool';
export * from './core/ErrorHandler';
export * from './core/Application';

// Agent System
export * from './agent/core/AgentCapability';
export * from './agent/core/ComposableAgent';
export * from './agent/EnhancedBaseAgent';

// Capabilities
export * from './agent/capabilities/WebNavigationCapability';

// Tools System
export * from './tools/core/ToolPlugin';
export * from './tools/plugins/BrowserNavigationPlugin';
export * from './tools/plugins/ProductivityPlugin';
export * from './tools/plugins/AnswerPlugin';

// Runtime System
export * from './runtime/EnhancedExecutionPipeline';

// Browser System
export * from './browser/EnhancedBrowserContext';

// Events System (enhanced)
export * from './events/EventBus';

// Re-export existing components that are still compatible
export { ExecutionContext } from './runtime/ExecutionContext';
export { BrowserPage } from './browser/BrowserPage';
export { AgentGraph } from './graph/AgentGraph';
export { Orchestrator } from './orchestrators/Orchestrator';

// Service tokens for dependency injection
export const SERVICE_TOKENS = {
  // Core services
  LOGGER: 'logger',
  CONFIG_MANAGER: 'configManager',
  EVENT_BUS: 'eventBus',
  ERROR_HANDLER: 'errorHandler',
  RESOURCE_POOL: 'resourcePool',
  
  // Agent services
  CAPABILITY_REGISTRY: 'capabilityRegistry',
  CAPABILITY_EXECUTOR: 'capabilityExecutor',
  AGENT_FACTORY: 'agentFactory',
  
  // Tool services
  TOOL_REGISTRY: 'toolRegistry',
  TOOL_EXECUTOR: 'toolExecutor',
  
  // Browser services
  BROWSER_CONTEXT: 'browserContext',
  BROWSER_PAGE: 'browserPage',
  
  // LLM services
  LLM_CLIENT: 'llmClient',
  LLM_FACTORY: 'llmFactory',
  
  // Pipeline services
  EXECUTION_PIPELINE: 'executionPipeline',
  PIPELINE_FACTORY: 'pipelineFactory'
} as const;

// Configuration schemas
export const DEFAULT_CONFIGS = {
  application: {
    name: 'agent-dev',
    version: '2.0.0',
    environment: 'development',
    logging: {
      level: 'info',
      console: true,
      file: false
    }
  },
  
  resourcePool: {
    llm: {
      min: 1,
      max: 5,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000
    },
    browserPage: {
      min: 1,
      max: 3,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000
    }
  },
  
  capabilities: {
    webNavigation: {
      name: 'webNavigation',
      version: '1.0.0',
      enabled: true,
      priority: 10,
      browserSettings: {
        headless: false,
        timeout: 30000
      }
    },
    
    contentAnalysis: {
      name: 'contentAnalysis',
      version: '1.0.0',
      enabled: true,
      priority: 8,
      llmSettings: {
        temperature: 0.7,
        maxTokens: 1000
      }
    },
    
    taskPlanning: {
      name: 'taskPlanning',
      version: '1.0.0',
      enabled: true,
      priority: 9,
      planningSettings: {
        maxSteps: 20,
        allowParallel: true
      }
    }
  },
  
  agents: {
    webAgent: {
      requiredCapabilities: ['webNavigation', 'contentAnalysis'],
      optionalCapabilities: [],
      settings: {
        systemPrompt: 'You are a web browsing agent.',
        maxIterations: 10,
        timeout: 60000,
        useVision: true
      }
    },
    
    planningAgent: {
      requiredCapabilities: ['taskPlanning', 'contentAnalysis'],
      optionalCapabilities: [],
      settings: {
        systemPrompt: 'You are a task planning agent.',
        maxIterations: 15,
        timeout: 45000
      }
    }
  },
  
  browser: {
    maximumWaitPageLoadTime: 5.0,
    waitBetweenActions: 0.1,
    homePageUrl: 'https://www.google.com',
    useVision: true,
    poolSize: 3,
    pageTimeout: 30000,
    resourceLimits: {
      maxPages: 10,
      maxMemoryMB: 512,
      maxCPUPercent: 80
    },
    cacheSettings: {
      enablePageCache: true,
      cacheSize: 50,
      cacheTTL: 300000
    }
  }
} as const;

// Factory functions for easy setup
export const createDefaultApplication = async () => {
  const { Application } = await import('./core/Application');
  const app = new Application(DEFAULT_CONFIGS.application);
  await app.initialize();
  return app;
};

export const createWebAgent = async (container: any) => {
  const { AgentFactory } = await import('./agent/core/ComposableAgent');
  const factory = container.get('agentFactory') as AgentFactory;
  return factory.createWebAgent('web_agent_1', 'Web Browsing Agent');
};

export const createPlanningAgent = async (container: any) => {
  const { AgentFactory } = await import('./agent/core/ComposableAgent');
  const factory = container.get('agentFactory') as AgentFactory;
  return factory.createPlanningAgent('planning_agent_1', 'Task Planning Agent');
};

// Utility types
export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];
export type DefaultConfig = typeof DEFAULT_CONFIGS;

// Version information
export const ARCHITECTURE_VERSION = '2.0.0';
export const COMPATIBLE_VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];

/**
 * Migration utilities for upgrading from the old architecture
 */
export const MigrationUtils = {
  /**
   * Check if migration is needed
   */
  needsMigration: (currentVersion: string): boolean => {
    return !COMPATIBLE_VERSIONS.includes(currentVersion);
  },
  
  /**
   * Get migration steps for a specific version
   */
  getMigrationSteps: (fromVersion: string): string[] => {
    // Return migration steps based on version
    if (fromVersion.startsWith('1.')) {
      return [
        'Update dependency injection registration',
        'Convert tools to plugin format',
        'Update agent initialization',
        'Migrate browser context usage',
        'Update event handlers'
      ];
    }
    return [];
  },
  
  /**
   * Validate migration completion
   */
  validateMigration: async (container: any): Promise<boolean> => {
    try {
      // Check if all required services are available
      const requiredServices = [
        'configManager',
        'eventBus',
        'errorHandler',
        'resourcePool',
        'capabilityRegistry'
      ];
      
      for (const service of requiredServices) {
        if (!container.has(service)) {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Development utilities
 */
export const DevUtils = {
  /**
   * Create a development container with all services
   */
  createDevContainer: async () => {
    const { DIContainer } = await import('./core/DIContainer');
    const { ConfigManager } = await import('./core/ConfigManager');
    const { ErrorHandler } = await import('./core/ErrorHandler');
    const { ResourcePool } = await import('./core/ResourcePool');
    const { EventBus } = await import('./events/EventBus');
    
    const container = new DIContainer();
    
    // Register core services
    container.registerSingleton('configManager', ConfigManager);
    container.registerSingleton('errorHandler', ErrorHandler);
    container.registerSingleton('resourcePool', ResourcePool);
    container.registerSingleton('eventBus', EventBus);
    
    return container;
  },
  
  /**
   * Create a test agent for development
   */
  createTestAgent: async (container: any) => {
    const factory = container.get('agentFactory');
    return factory.createCustomAgent({
      id: 'test_agent',
      name: 'Test Agent',
      description: 'Agent for testing and development',
      capabilities: ['webNavigation', 'contentAnalysis'],
      settings: {
        debugMode: true,
        maxIterations: 5
      }
    });
  }
};

// Export type guards for runtime type checking
export const TypeGuards = {
  isAgentInput: (obj: any): obj is import('./agent/EnhancedBaseAgent').EnhancedAgentInput => {
    return obj && typeof obj.instruction === 'string';
  },
  
  isAgentOutput: (obj: any): obj is import('./agent/EnhancedBaseAgent').EnhancedAgentOutput => {
    return obj && typeof obj.success === 'boolean';
  },
  
  isCapabilityRequest: (obj: any): obj is import('./agent/core/AgentCapability').AgentCapabilityRequest => {
    return obj && typeof obj.id === 'string' && typeof obj.type === 'string';
  },
  
  isCapabilityResponse: (obj: any): obj is import('./agent/core/AgentCapability').AgentCapabilityResponse => {
    return obj && typeof obj.requestId === 'string' && obj.result;
  }
};
