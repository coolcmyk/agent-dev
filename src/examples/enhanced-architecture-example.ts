/**
 * Enhanced Architecture Usage Example
 * 
 * Demonstrates how to use the new component-based architecture with
 * dependency injection, resource pooling, and capability system.
 */

import {
  Application,
  DIContainer,
  ConfigManager,
  ResourcePool,
  ErrorHandler,
  EventBus,
  AgentCapabilityRegistry,
  CapabilityExecutor,
  AgentFactory,
  ComposableAgent,
  EnhancedExecutionPipeline,
  WebNavigationCapability,
  ContentAnalysisCapability,
  TaskPlanningCapability,
  EnhancedBrowserContext,
  SERVICE_TOKENS,
  DEFAULT_CONFIGS,
  createDefaultApplication
} from '../index';

/**
 * Example 1: Basic Application Setup
 */
export async function basicSetupExample() {
  console.log('🚀 Setting up enhanced agent architecture...\n');
  
  // Method 1: Using the default application factory
  const app = await createDefaultApplication();
  
  console.log('✅ Application initialized with default configuration');
  console.log(`📊 Application name: ${app.metadata.name}`);
  console.log(`🔧 Environment: ${app.metadata.environment}\n`);
  
  // Access services from the application
  const container = app.getContainer();
  const configManager = container.get<ConfigManager>('configManager');
  const eventBus = container.get<EventBus>('eventBus');
  
  console.log('📋 Available services:', Object.keys(container.getRegistrations()));
  
  await app.cleanup();
  console.log('🧹 Application cleaned up\n');
}

/**
 * Example 2: Manual Container Setup with Custom Configuration
 */
export async function manualSetupExample() {
  console.log('⚙️  Manual container setup example...\n');
  
  // Create container
  const container = new DIContainer();
  
  // Register core services
  container.registerSingleton('logger', () => console);
  
  container.registerSingleton('configManager', () => {
    const config = new ConfigManager({
      ...DEFAULT_CONFIGS,
      // Custom configuration overrides
      application: {
        ...DEFAULT_CONFIGS.application,
        name: 'custom-agent-app',
        logging: { level: 'debug', console: true, file: true }
      }
    }, container);
    return config;
  });
  
  container.registerSingleton('eventBus', () => new EventBus(container));
  container.registerSingleton('errorHandler', () => new ErrorHandler(container));
  container.registerSingleton('resourcePool', () => new ResourcePool(container));
  
  // Register capability system
  container.registerSingleton('capabilityRegistry', () => new AgentCapabilityRegistry(container));
  container.registerSingleton('capabilityExecutor', () => new CapabilityExecutor(container));
  container.registerSingleton('agentFactory', () => new AgentFactory(container));
  
  // Initialize services
  const services = ['configManager', 'eventBus', 'errorHandler', 'resourcePool', 'capabilityRegistry', 'capabilityExecutor', 'agentFactory'];
  
  for (const serviceName of services) {
    const service = container.get(serviceName);
    if (service.initialize) {
      await service.initialize();
      console.log(`✅ Initialized ${serviceName}`);
    }
  }
  
  console.log('\n🎯 Manual setup completed successfully!\n');
  
  // Cleanup
  for (const serviceName of services.reverse()) {
    const service = container.get(serviceName);
    if (service.cleanup) {
      await service.cleanup();
    }
  }
}

/**
 * Example 3: Capability Registration and Usage
 */
export async function capabilityExample() {
  console.log('🧩 Capability system example...\n');
  
  const app = await createDefaultApplication();
  const container = app.getContainer();
  
  // Get capability registry
  const capabilityRegistry = container.get<AgentCapabilityRegistry>('capabilityRegistry');
  
  // Register capability classes
  capabilityRegistry.registerCapabilityClass('webNavigation', WebNavigationCapability);
  capabilityRegistry.registerCapabilityClass('contentAnalysis', ContentAnalysisCapability);
  capabilityRegistry.registerCapabilityClass('taskPlanning', TaskPlanningCapability);
  
  console.log('📝 Registered capability classes');
  
  // Create capability instances
  const webNavCap = await capabilityRegistry.createCapability('webNavigation', {
    name: 'webNavigation',
    version: '1.0.0',
    enabled: true,
    priority: 10
  });
  
  const contentCap = await capabilityRegistry.createCapability('contentAnalysis', {
    name: 'contentAnalysis',
    version: '1.0.0',
    enabled: true,
    priority: 8
  });
  
  console.log('🎯 Created capability instances');
  console.log(`🔍 Web Navigation capability metadata:`, webNavCap.metadata);
  console.log(`📊 Content Analysis capability metadata:`, contentCap.metadata);
  
  // Test capability execution
  const executor = container.get<CapabilityExecutor>('capabilityExecutor');
  
  const request = {
    id: 'test_request_1',
    type: 'web.navigation',
    payload: {
      url: 'https://www.example.com',
      action: 'navigate'
    },
    context: {
      agentId: 'test_agent',
      sessionId: 'test_session',
      metadata: {}
    },
    timestamp: Date.now()
  };
  
  try {
    const response = await executor.execute(request);
    console.log(`✅ Capability execution result:`, response.result.success ? '✅ Success' : '❌ Failed');
  } catch (error) {
    console.log(`⚠️  Capability execution failed:`, error.message);
  }
  
  console.log('\n🎭 Capability example completed\n');
  await app.cleanup();
}

/**
 * Example 4: Composable Agent Creation and Usage
 */
export async function agentExample() {
  console.log('🤖 Composable agent example...\n');
  
  const app = await createDefaultApplication();
  const container = app.getContainer();
  
  // Setup capabilities first
  const capabilityRegistry = container.get<AgentCapabilityRegistry>('capabilityRegistry');
  capabilityRegistry.registerCapabilityClass('webNavigation', WebNavigationCapability);
  capabilityRegistry.registerCapabilityClass('contentAnalysis', ContentAnalysisCapability);
  
  await capabilityRegistry.createCapability('webNavigation', DEFAULT_CONFIGS.capabilities.webNavigation);
  await capabilityRegistry.createCapability('contentAnalysis', DEFAULT_CONFIGS.capabilities.contentAnalysis);
  
  // Create agents using factory
  const agentFactory = container.get<AgentFactory>('agentFactory');
  
  // Create specialized agents
  const webAgent = agentFactory.createWebAgent('web_agent_1', 'Web Browsing Specialist');
  const generalAgent = agentFactory.createGeneralAgent('general_agent_1', 'General Purpose Assistant');
  
  await webAgent.initialize();
  await generalAgent.initialize();
  
  console.log('🎯 Created agents:');
  console.log(`  - Web Agent: ${webAgent.metadata.name} (capabilities: ${webAgent.metadata.capabilities.join(', ')})`);
  console.log(`  - General Agent: ${generalAgent.metadata.name} (capabilities: ${generalAgent.metadata.capabilities.join(', ')})`);
  
  // Start sessions and execute tasks
  const webSessionId = await webAgent.startSession('user123', { userPreference: 'detailed' });
  const generalSessionId = await generalAgent.startSession('user123', { mode: 'helpful' });
  
  console.log(`\n📝 Started sessions: ${webSessionId}, ${generalSessionId}`);
  
  // Execute tasks
  const webTask = {
    id: 'task_1',
    type: 'web.navigation',
    payload: {
      url: 'https://www.example.com',
      action: 'navigate'
    },
    priority: 1
  };
  
  const analysisTask = {
    id: 'task_2',
    type: 'content.analysis',
    payload: {
      content: 'This is a sample text to analyze for sentiment and key topics.',
      type: 'text',
      analysisType: 'sentiment'
    },
    priority: 2
  };
  
  try {
    console.log('\n🚀 Executing tasks...');
    
    const webResult = await webAgent.executeTask(webTask);
    console.log(`📊 Web task result: ${webResult.success ? '✅ Success' : '❌ Failed'}`);
    
    const analysisResult = await generalAgent.executeTask(analysisTask);
    console.log(`📊 Analysis task result: ${analysisResult.success ? '✅ Success' : '❌ Failed'}`);
    
    // Show session statistics
    const webSession = webAgent.getSession();
    const generalSession = generalAgent.getSession();
    
    console.log(`\n📈 Session statistics:`);
    console.log(`  - Web Agent: ${webSession?.taskHistory.length} tasks completed`);
    console.log(`  - General Agent: ${generalSession?.taskHistory.length} tasks completed`);
    
  } catch (error) {
    console.log(`⚠️  Task execution failed:`, error.message);
  }
  
  // End sessions
  await webAgent.endSession();
  await generalAgent.endSession();
  
  console.log('\n🎭 Agent example completed\n');
  await app.cleanup();
}

/**
 * Example 5: Pipeline Execution
 */
export async function pipelineExample() {
  console.log('🔄 Pipeline execution example...\n');
  
  const app = await createDefaultApplication();
  const container = app.getContainer();
  
  // Create a pipeline configuration
  const pipelineConfig = {
    name: 'web_analysis_pipeline',
    description: 'Pipeline for web navigation and content analysis',
    stages: [
      {
        id: 'navigate',
        name: 'Navigate to URL',
        type: 'agent' as const,
        config: {
          agentId: 'web_agent_1',
          taskType: 'web.navigation',
          taskPayload: {
            action: 'navigate'
          }
        }
      },
      {
        id: 'extract',
        name: 'Extract Content',
        type: 'agent' as const,
        config: {
          agentId: 'web_agent_1',
          taskType: 'web.extract',
          taskPayload: {
            action: 'extract'
          }
        },
        dependencies: ['navigate']
      },
      {
        id: 'analyze',
        name: 'Analyze Content',
        type: 'agent' as const,
        config: {
          agentId: 'general_agent_1',
          taskType: 'content.analysis',
          taskPayload: {
            analysisType: 'summarize'
          }
        },
        dependencies: ['extract']
      },
      {
        id: 'validate',
        name: 'Validate Results',
        type: 'validation' as const,
        config: {
          validationType: 'schema',
          validationConfig: {
            required: ['summary', 'confidence']
          }
        },
        dependencies: ['analyze'],
        optional: true
      }
    ],
    settings: {
      timeout: 120000,
      retryCount: 2,
      parallelExecution: false
    }
  };
  
  // Create and execute pipeline
  const pipeline = new EnhancedExecutionPipeline(pipelineConfig, container);
  await pipeline.initialize();
  
  console.log(`🎯 Created pipeline: ${pipelineConfig.name}`);
  console.log(`📋 Pipeline stages: ${pipelineConfig.stages.map(s => s.name).join(' → ')}`);
  
  const input = {
    url: 'https://www.example.com',
    extractOptions: { includeText: true, includeImages: false },
    analysisOptions: { maxLength: 200 }
  };
  
  try {
    console.log('\n🚀 Executing pipeline...');
    const execution = await pipeline.execute(input, { userId: 'user123' });
    
    console.log(`📊 Pipeline execution ${execution.status}:`);
    console.log(`  - Duration: ${execution.context.endTime! - execution.context.startTime}ms`);
    console.log(`  - Progress: ${execution.progress}%`);
    console.log(`  - Stages completed: ${execution.context.stageResults.size}`);
    
    if (execution.status === 'completed') {
      console.log(`  - Final result available: ${!!execution.context.output}`);
    } else if (execution.error) {
      console.log(`  - Error: ${execution.error.message}`);
    }
    
  } catch (error) {
    console.log(`⚠️  Pipeline execution failed:`, error.message);
  }
  
  await pipeline.cleanup();
  console.log('\n🔄 Pipeline example completed\n');
  await app.cleanup();
}

/**
 * Example 6: Event-Driven Communication
 */
export async function eventExample() {
  console.log('📡 Event-driven communication example...\n');
  
  const app = await createDefaultApplication();
  const container = app.getContainer();
  const eventBus = container.get<EventBus>('eventBus');
  
  // Set up event listeners
  const eventLog: string[] = [];
  
  eventBus.on('agent.task.started', (data) => {
    eventLog.push(`🚀 Task started: ${data.task.id} (${data.task.type})`);
  });
  
  eventBus.on('agent.task.completed', (data) => {
    eventLog.push(`✅ Task completed: ${data.task.id} - ${data.result.success ? 'Success' : 'Failed'}`);
  });
  
  eventBus.on('capability.execution.started', (data) => {
    eventLog.push(`🧩 Capability execution started: ${data.request.type}`);
  });
  
  eventBus.on('capability.execution.completed', (data) => {
    eventLog.push(`🎯 Capability execution completed: ${data.capability}`);
  });
  
  eventBus.on('browser.navigation.completed', (data) => {
    eventLog.push(`🌐 Navigation completed: ${data.url} (${data.duration}ms)`);
  });
  
  console.log('📝 Registered event listeners');
  
  // Simulate some events
  eventBus.emit('agent.task.started', {
    agentId: 'test_agent',
    task: { id: 'task_1', type: 'web.navigation' }
  });
  
  eventBus.emit('capability.execution.started', {
    request: { type: 'web.navigation', id: 'req_1' }
  });
  
  eventBus.emit('browser.navigation.completed', {
    url: 'https://www.example.com',
    duration: 1250,
    fromCache: false
  });
  
  eventBus.emit('capability.execution.completed', {
    capability: 'webNavigation',
    request: { id: 'req_1' }
  });
  
  eventBus.emit('agent.task.completed', {
    agentId: 'test_agent',
    task: { id: 'task_1', type: 'web.navigation' },
    result: { success: true, duration: 1500 }
  });
  
  // Wait a bit for async event processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n📋 Event log:');
  eventLog.forEach(log => console.log(`  ${log}`));
  
  console.log('\n📡 Event example completed\n');
  await app.cleanup();
}

/**
 * Example 7: Resource Pool Management
 */
export async function resourcePoolExample() {
  console.log('🏊 Resource pool management example...\n');
  
  const app = await createDefaultApplication();
  const container = app.getContainer();
  const resourcePool = container.get<ResourcePool>('resourcePool');
  
  // Create a mock resource pool
  await resourcePool.createPool('mockLLM', {
    create: async () => ({ 
      id: Math.random().toString(36), 
      created: Date.now(),
      generate: async (prompt: string) => ({ text: `Mock response to: ${prompt}` })
    }),
    destroy: async (resource) => {
      console.log(`🗑️  Destroyed mock LLM: ${resource.id}`);
    },
    validate: async (resource) => {
      const age = Date.now() - resource.created;
      return age < 600000; // Valid for 10 minutes
    }
  }, {
    min: 1,
    max: 3,
    acquireTimeoutMillis: 5000,
    idleTimeoutMillis: 60000
  });
  
  console.log('✅ Created mock LLM resource pool');
  
  // Test resource acquisition and release
  console.log('\n🎯 Testing resource acquisition...');
  
  const resources: any[] = [];
  
  for (let i = 0; i < 3; i++) {
    try {
      const resource = await resourcePool.acquire('mockLLM');
      resources.push(resource);
      console.log(`📥 Acquired resource ${i + 1}: ${resource.id}`);
      
      // Use the resource
      const result = await resource.generate(`Test prompt ${i + 1}`);
      console.log(`💬 Response: ${result.text}`);
      
    } catch (error) {
      console.log(`❌ Failed to acquire resource ${i + 1}: ${error.message}`);
    }
  }
  
  // Release resources
  console.log('\n🔄 Releasing resources...');
  for (let i = 0; i < resources.length; i++) {
    await resourcePool.release('mockLLM', resources[i]);
    console.log(`📤 Released resource ${i + 1}: ${resources[i].id}`);
  }
  
  // Get pool statistics
  const stats = resourcePool.getPoolStats('mockLLM');
  console.log('\n📊 Resource pool statistics:');
  console.log(`  - Size: ${stats.size}`);
  console.log(`  - Available: ${stats.available}`);
  console.log(`  - Borrowed: ${stats.borrowed}`);
  console.log(`  - Pending: ${stats.pending}`);
  
  console.log('\n🏊 Resource pool example completed\n');
  await app.cleanup();
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🎉 Running Enhanced Architecture Examples\n');
  console.log('=' .repeat(60) + '\n');
  
  try {
    await basicSetupExample();
    await manualSetupExample();
    await capabilityExample();
    await agentExample();
    await pipelineExample();
    await eventExample();
    await resourcePoolExample();
    
    console.log('🎊 All examples completed successfully!');
    
  } catch (error) {
    console.error('💥 Example failed:', error);
    throw error;
  }
}

// Export for individual example execution
export {
  basicSetupExample,
  manualSetupExample,
  capabilityExample,
  agentExample,
  pipelineExample,
  eventExample,
  resourcePoolExample
};

// Main execution if this file is run directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
