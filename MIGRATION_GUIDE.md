# Enhanced Architecture Migration Guide

This guide helps you migrate from the legacy agent-dev architecture to the new enhanced component-based system with dependency injection, resource pooling, and capability management.

## Overview of Changes

### 🏗️ **New Architecture Components**

1. **Core Infrastructure**
   - `DIContainer` - Dependency injection container
   - `ConfigManager` - Centralized configuration management
   - `ResourcePool` - Resource pooling for expensive objects
   - `ErrorHandler` - Centralized error handling
   - `Application` - Main application bootstrap

2. **Agent Capability System**
   - `AgentCapability` - Base class for composable capabilities
   - `AgentCapabilityRegistry` - Registry for managing capabilities
   - `ComposableAgent` - Agents built from capabilities
   - `CapabilityExecutor` - Executes capability requests

3. **Enhanced Components**
   - `EnhancedBaseAgent` - Updated base agent with DI integration
   - `EnhancedBrowserContext` - Browser context with resource pooling
   - `EnhancedExecutionPipeline` - Pipeline with stage management

4. **Plugin Architecture**
   - `ToolPlugin` - Base class for tool plugins
   - Tool plugins for different categories (Browser, Productivity, etc.)

## Migration Steps

### Step 1: Update Imports and Dependencies

**Before (Legacy):**
```typescript
import { BaseAgent } from '@/lib/agent/BaseAgent';
import { BrowserContext } from '@/lib/browser/BrowserContext';
import { ExecutionPipeline } from '@/lib/runtime/ExecutionPipeline';
import { ToolRegistry } from '@/lib/tools/base/ToolRegistry';
```

**After (Enhanced):**
```typescript
import { 
  EnhancedBaseAgent,
  EnhancedBrowserContext,
  EnhancedExecutionPipeline,
  ComposableAgent,
  AgentCapabilityRegistry,
  DIContainer,
  createDefaultApplication
} from '@/lib';
```

### Step 2: Replace Manual Initialization with DI Container

**Before (Legacy):**
```typescript
class MyAgent extends BaseAgent {
  constructor(options: AgentOptions) {
    super(options);
    this.toolRegistry = new ToolRegistry();
    this.browserContext = options.executionContext.browserContext;
  }
}

// Manual initialization
const agent = new MyAgent(options);
await agent.initialize();
```

**After (Enhanced):**
```typescript
// Set up application with DI container
const app = await createDefaultApplication();
const container = app.getContainer();

// Or create custom agent using factory
const agentFactory = container.get('agentFactory');
const agent = agentFactory.createWebAgent('my_agent', 'My Agent');
await agent.initialize();
```

### Step 3: Convert Custom Agents to Capability-Based

**Before (Legacy):**
```typescript
class CustomAgent extends BaseAgent {
  protected generateSystemPrompt(): string {
    return "You are a custom agent that can browse and analyze content.";
  }

  protected createToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.registerTool('navigate', new NavigateTool());
    registry.registerTool('extract', new ExtractTool());
    return registry;
  }

  async customMethod(input: string): Promise<string> {
    // Custom logic
    return "result";
  }
}
```

**After (Enhanced):**
```typescript
class CustomAgent extends EnhancedBaseAgent {
  constructor(container: DIContainer) {
    super({
      id: 'custom_agent',
      name: 'Custom Agent',
      description: 'Agent that can browse and analyze content',
      requiredCapabilities: ['webNavigation', 'contentAnalysis'],
      settings: {
        systemPrompt: "You are a custom agent that can browse and analyze content.",
        maxIterations: 10,
        useVision: true
      }
    }, container);
  }

  protected generateSystemPrompt(): string {
    return this.config.settings.systemPrompt || '';
  }

  protected getAgentName(): string {
    return this.config.name;
  }

  // Custom capabilities are now handled through the capability system
  async customAnalysis(content: string): Promise<any> {
    const task = {
      id: 'custom_analysis',
      type: 'content.analysis',
      payload: { content, analysisType: 'custom' }
    };
    
    return await this.composableAgent.executeTask(task);
  }
}
```

### Step 4: Migrate Tools to Plugin System

**Before (Legacy):**
```typescript
class NavigateTool extends BaseTool {
  async execute(params: NavigateParams): Promise<NavigateResult> {
    // Tool implementation
  }
}

// Manual registration
toolRegistry.registerTool('navigate', new NavigateTool());
```

**After (Enhanced):**
```typescript
class NavigationCapability extends AgentCapability {
  canHandle(request: AgentCapabilityRequest): boolean {
    return request.type === 'web.navigation';
  }

  async execute(request: AgentCapabilityRequest): Promise<AgentCapabilityResponse> {
    // Capability implementation
    const { url, action } = request.payload;
    
    // Use browser context from DI container
    const browserContext = this.container.get('browserContext');
    await browserContext.navigateToUrl(url);
    
    return this.createSuccessResponse(request.id, { success: true });
  }
}

// Register capability
const capabilityRegistry = container.get('capabilityRegistry');
capabilityRegistry.registerCapabilityClass('webNavigation', NavigationCapability);
```

### Step 5: Update Browser Context Usage

**Before (Legacy):**
```typescript
const browserContext = new BrowserContext(config);
await browserContext.navigateToUrl(url);
const state = await browserContext.getBrowserStateString();
```

**After (Enhanced):**
```typescript
// Browser context is managed by DI container and resource pool
const browserContext = container.get<EnhancedBrowserContext>('browserContext');
await browserContext.navigateToUrl(url, { useCache: true });
const state = await browserContext.getBrowserState();

// Resource pooling automatically manages page lifecycle
const page = await browserContext.getPage();
```

### Step 6: Replace Direct LLM Access with Resource Pool

**Before (Legacy):**
```typescript
class MyAgent extends BaseAgent {
  private llm: BaseChatModel | null = null;

  async getLLM(): Promise<BaseChatModel> {
    if (!this.llm) {
      this.llm = await LangChainProviderFactory.createLLM();
    }
    return this.llm;
  }
}
```

**After (Enhanced):**
```typescript
class MyAgent extends EnhancedBaseAgent {
  protected async getLLM(): Promise<BaseChatModel> {
    // LLM is automatically managed by resource pool
    return await this.resourcePool.acquire('llm');
  }

  // LLM is automatically released when agent is cleaned up
}
```

### Step 7: Update Event Handling

**Before (Legacy):**
```typescript
// Manual event bus creation and management
const eventBus = new EventBus();
eventBus.emit('custom.event', data);
```

**After (Enhanced):**
```typescript
// Event bus is injected via DI container
class MyComponent extends BaseComponent {
  constructor(container: DIContainer) {
    super('my.component', container.get('logger'));
    this.eventBus = container.get('eventBus');
  }

  async doSomething() {
    // Events are automatically handled with middleware and error handling
    this.eventBus.emit('custom.event', data);
  }
}
```

### Step 8: Convert Pipeline Usage

**Before (Legacy):**
```typescript
const pipeline = new ExecutionPipeline(executionContext);
const llm = await pipeline.getLLM();
const browserState = await pipeline.getBrowserState();
```

**After (Enhanced):**
```typescript
const pipelineConfig = {
  name: 'my_pipeline',
  stages: [
    {
      id: 'stage1',
      name: 'First Stage',
      type: 'agent',
      config: { agentId: 'my_agent', taskType: 'web.navigation' }
    }
  ]
};

const pipeline = new EnhancedExecutionPipeline(pipelineConfig, container);
await pipeline.initialize();

const execution = await pipeline.execute(input);
```

## Configuration Migration

### Update Configuration Structure

**Before (Legacy):**
```typescript
const config = {
  browserSettings: { headless: false },
  llmSettings: { temperature: 0.7 }
};
```

**After (Enhanced):**
```typescript
const config = {
  application: {
    name: 'my-app',
    environment: 'development'
  },
  capabilities: {
    webNavigation: {
      name: 'webNavigation',
      version: '1.0.0',
      enabled: true,
      browserSettings: { headless: false }
    }
  },
  resourcePool: {
    llm: {
      min: 1,
      max: 5,
      acquireTimeoutMillis: 30000
    }
  }
};
```

## Testing Migration

### Update Test Setup

**Before (Legacy):**
```typescript
describe('Agent Tests', () => {
  let agent: MyAgent;
  
  beforeEach(async () => {
    const executionContext = new ExecutionContext(config);
    agent = new MyAgent({ executionContext });
    await agent.initialize();
  });
});
```

**After (Enhanced):**
```typescript
describe('Agent Tests', () => {
  let container: DIContainer;
  let agent: MyAgent;
  
  beforeEach(async () => {
    container = await createTestContainer();
    const agentFactory = container.get('agentFactory');
    agent = agentFactory.createCustomAgent({
      id: 'test_agent',
      name: 'Test Agent',
      requiredCapabilities: ['webNavigation']
    });
    await agent.initialize();
  });
  
  afterEach(async () => {
    await container.cleanup();
  });
});
```

## Common Migration Issues

### Issue 1: Circular Dependencies
**Problem:** Components trying to inject each other directly.
**Solution:** Use factory functions or lazy initialization.

```typescript
// Wrong
container.registerSingleton('serviceA', () => new ServiceA(container.get('serviceB')));
container.registerSingleton('serviceB', () => new ServiceB(container.get('serviceA')));

// Correct
container.registerSingleton('serviceA', (container) => new ServiceA());
container.registerSingleton('serviceB', (container) => new ServiceB());
// Inject dependencies after creation in initialize() methods
```

### Issue 2: Missing Service Registration
**Problem:** Trying to access services that aren't registered.
**Solution:** Ensure all required services are registered before use.

```typescript
// Check if service exists before using
if (container.has('myService')) {
  const service = container.get('myService');
}
```

### Issue 3: Resource Leaks
**Problem:** Not properly releasing resources from pools.
**Solution:** Use try/finally blocks or automatic cleanup.

```typescript
// Manual resource management
const resource = await resourcePool.acquire('llm');
try {
  // Use resource
} finally {
  await resourcePool.release('llm', resource);
}

// Or use the enhanced components that handle this automatically
```

## Verification Steps

1. **Dependency Check**
   ```typescript
   const requiredServices = ['configManager', 'eventBus', 'errorHandler', 'resourcePool'];
   for (const service of requiredServices) {
     if (!container.has(service)) {
       throw new Error(`Missing required service: ${service}`);
     }
   }
   ```

2. **Capability Verification**
   ```typescript
   const capabilityRegistry = container.get('capabilityRegistry');
   const capabilities = capabilityRegistry.getAllCapabilities();
   console.log('Available capabilities:', Array.from(capabilities.keys()));
   ```

3. **Resource Pool Status**
   ```typescript
   const resourcePool = container.get('resourcePool');
   const stats = resourcePool.getPoolStats('llm');
   console.log('LLM pool stats:', stats);
   ```

## Benefits After Migration

1. **Better Resource Management** - Automatic pooling and cleanup
2. **Improved Testability** - Easy dependency mocking
3. **Enhanced Modularity** - Mix and match capabilities
4. **Better Error Handling** - Centralized error processing
5. **Performance Improvements** - Resource pooling and caching
6. **Easier Maintenance** - Clear component boundaries
7. **Better Observability** - Enhanced event system and logging

## Getting Help

If you encounter issues during migration:

1. Check the examples in `/src/examples/enhanced-architecture-example.ts`
2. Review the type definitions in the core interfaces
3. Use the migration utilities in the main index file
4. Check the console for DI container registration errors

The enhanced architecture is designed to be backward compatible where possible, so you can migrate incrementally by updating one component at a time.
