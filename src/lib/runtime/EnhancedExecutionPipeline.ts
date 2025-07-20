/**
 * Enhanced Execution Pipeline
 * 
 * Integrates with the new component architecture, resource pooling, and dependency injection
 */

import { BaseComponent } from '../core/interfaces';
import { DIContainer } from '../core/DIContainer';
import { ResourcePool } from '../core/ResourcePool';
import { EventBus } from '../events/EventBus';
import { ComposableAgent } from '../agent/core/ComposableAgent';
import { AgentTask, AgentTaskResult } from '../agent/core/ComposableAgent';

export interface PipelineConfig {
  name: string;
  description?: string;
  stages: PipelineStage[];
  settings?: {
    timeout?: number;
    retryCount?: number;
    parallelExecution?: boolean;
    resourceLimits?: Record<string, number>;
  };
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'validation' | 'transformation';
  config: any;
  dependencies?: string[];
  optional?: boolean;
  timeout?: number;
  retryCount?: number;
}

export interface PipelineContext {
  id: string;
  input: any;
  output?: any;
  stageResults: Map<string, any>;
  metadata: Record<string, any>;
  startTime: number;
  endTime?: number;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  context: PipelineContext;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStage?: string;
  progress: number;
  error?: Error;
  createdAt: number;
  updatedAt: number;
}

export class EnhancedExecutionPipeline extends BaseComponent {
  private config: PipelineConfig;
  private container: DIContainer;
  private resourcePool: ResourcePool;
  private eventBus: EventBus;
  private executions = new Map<string, PipelineExecution>();
  private stageExecutors = new Map<string, StageExecutor>();

  constructor(
    config: PipelineConfig,
    container: DIContainer
  ) {
    super(`pipeline.${config.name}`, container.get('logger'));
    this.config = config;
    this.container = container;
    this.resourcePool = container.get('resourcePool');
    this.eventBus = container.get('eventBus');
  }

  /**
   * Execute the pipeline with given input
   */
  async execute(input: any, metadata: Record<string, any> = {}): Promise<PipelineExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context: PipelineContext = {
      id: executionId,
      input,
      stageResults: new Map(),
      metadata: { ...metadata },
      startTime: Date.now()
    };

    const execution: PipelineExecution = {
      id: executionId,
      pipelineId: this.config.name,
      context,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.executions.set(executionId, execution);
    
    try {
      await this.executeStages(execution);
      
      execution.status = 'completed';
      execution.progress = 100;
      execution.context.endTime = Date.now();
      
      this.eventBus.emit('pipeline.execution.completed', { execution });
      
    } catch (error) {
      execution.status = 'failed';
      execution.error = error as Error;
      execution.context.endTime = Date.now();
      
      this.eventBus.emit('pipeline.execution.failed', { execution, error });
      throw error;
    } finally {
      execution.updatedAt = Date.now();
    }

    return execution;
  }

  /**
   * Execute all pipeline stages
   */
  private async executeStages(execution: PipelineExecution): Promise<void> {
    const { stages } = this.config;
    const { context } = execution;
    
    execution.status = 'running';
    this.eventBus.emit('pipeline.execution.started', { execution });

    // Build execution order based on dependencies
    const executionOrder = this.buildExecutionOrder(stages);
    const totalStages = executionOrder.length;
    
    for (let i = 0; i < executionOrder.length; i++) {
      const stageGroup = executionOrder[i];
      
      // Execute stages in parallel if they have no dependencies between them
      if (this.config.settings?.parallelExecution && stageGroup.length > 1) {
        await Promise.all(stageGroup.map(stage => this.executeStage(stage, execution)));
      } else {
        for (const stage of stageGroup) {
          await this.executeStage(stage, execution);
        }
      }
      
      // Update progress
      execution.progress = ((i + 1) / totalStages) * 100;
      execution.updatedAt = Date.now();
      
      this.eventBus.emit('pipeline.stage.group.completed', {
        execution,
        stageGroup: stageGroup.map(s => s.id),
        progress: execution.progress
      });
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(stage: PipelineStage, execution: PipelineExecution): Promise<void> {
    const { context } = execution;
    execution.currentStage = stage.id;
    
    this.logger.debug(`Executing stage: ${stage.name} (${stage.id})`);
    
    try {
      this.eventBus.emit('pipeline.stage.started', { execution, stage });
      
      const executor = this.getStageExecutor(stage.type);
      const stageContext = this.createStageContext(stage, context);
      
      const result = await executor.execute(stage, stageContext);
      
      context.stageResults.set(stage.id, result);
      
      this.eventBus.emit('pipeline.stage.completed', { 
        execution, 
        stage, 
        result 
      });
      
    } catch (error) {
      this.logger.error(`Stage ${stage.id} failed:`, error);
      
      if (!stage.optional) {
        throw error;
      }
      
      // Log optional stage failure but continue
      context.stageResults.set(stage.id, { 
        error: error as Error, 
        optional: true 
      });
      
      this.eventBus.emit('pipeline.stage.failed', { 
        execution, 
        stage, 
        error,
        optional: true
      });
    }
  }

  /**
   * Build execution order based on stage dependencies
   */
  private buildExecutionOrder(stages: PipelineStage[]): PipelineStage[][] {
    const stageMap = new Map(stages.map(stage => [stage.id, stage]));
    const visited = new Set<string>();
    const executionOrder: PipelineStage[][] = [];
    
    while (visited.size < stages.length) {
      const currentGroup: PipelineStage[] = [];
      
      for (const stage of stages) {
        if (visited.has(stage.id)) continue;
        
        // Check if all dependencies are satisfied
        const dependencies = stage.dependencies || [];
        const allDependenciesMet = dependencies.every(dep => visited.has(dep));
        
        if (allDependenciesMet) {
          currentGroup.push(stage);
        }
      }
      
      if (currentGroup.length === 0) {
        throw new Error('Circular dependency detected in pipeline stages');
      }
      
      // Mark stages as visited
      currentGroup.forEach(stage => visited.add(stage.id));
      executionOrder.push(currentGroup);
    }
    
    return executionOrder;
  }

  /**
   * Get stage executor for stage type
   */
  private getStageExecutor(type: string): StageExecutor {
    if (!this.stageExecutors.has(type)) {
      const executor = this.createStageExecutor(type);
      this.stageExecutors.set(type, executor);
    }
    
    return this.stageExecutors.get(type)!;
  }

  /**
   * Create stage executor for specific type
   */
  private createStageExecutor(type: string): StageExecutor {
    switch (type) {
      case 'agent':
        return new AgentStageExecutor(this.container);
      case 'tool':
        return new ToolStageExecutor(this.container);
      case 'validation':
        return new ValidationStageExecutor(this.container);
      case 'transformation':
        return new TransformationStageExecutor(this.container);
      default:
        throw new Error(`Unknown stage type: ${type}`);
    }
  }

  /**
   * Create stage execution context
   */
  private createStageContext(stage: PipelineStage, pipelineContext: PipelineContext): any {
    return {
      stageId: stage.id,
      stageName: stage.name,
      pipelineContext,
      input: this.getStageInput(stage, pipelineContext),
      dependencies: this.getStageDependencies(stage, pipelineContext),
      config: stage.config
    };
  }

  /**
   * Get input for a stage based on dependencies
   */
  private getStageInput(stage: PipelineStage, context: PipelineContext): any {
    const dependencies = stage.dependencies || [];
    
    if (dependencies.length === 0) {
      return context.input;
    }
    
    if (dependencies.length === 1) {
      return context.stageResults.get(dependencies[0]);
    }
    
    // Multiple dependencies - return combined results
    const combinedInput: Record<string, any> = {};
    dependencies.forEach(dep => {
      combinedInput[dep] = context.stageResults.get(dep);
    });
    
    return combinedInput;
  }

  /**
   * Get dependency results for a stage
   */
  private getStageeDependencies(stage: PipelineStage, context: PipelineContext): Record<string, any> {
    const dependencies: Record<string, any> = {};
    
    (stage.dependencies || []).forEach(dep => {
      dependencies[dep] = context.stageResults.get(dep);
    });
    
    return dependencies;
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.context.endTime = Date.now();
      execution.updatedAt = Date.now();
      
      this.eventBus.emit('pipeline.execution.cancelled', { execution });
    }
  }

  /**
   * Get all executions
   */
  getAllExecutions(): Map<string, PipelineExecution> {
    return new Map(this.executions);
  }

  /**
   * Clear completed executions older than specified time
   */
  cleanupExecutions(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    
    for (const [id, execution] of this.executions) {
      if (execution.context.endTime && execution.context.endTime < cutoff) {
        this.executions.delete(id);
      }
    }
  }

  protected async doInitialize(): Promise<void> {
    this.logger.info(`Initializing pipeline: ${this.config.name}`);
    
    // Validate pipeline configuration
    this.validatePipelineConfig();
  }

  protected async doCleanup(): Promise<void> {
    this.logger.info(`Cleaning up pipeline: ${this.config.name}`);
    
    // Cancel all running executions
    for (const execution of this.executions.values()) {
      if (execution.status === 'running') {
        await this.cancelExecution(execution.id);
      }
    }
    
    this.executions.clear();
    this.stageExecutors.clear();
  }

  /**
   * Validate pipeline configuration
   */
  private validatePipelineConfig(): void {
    if (!this.config.stages || this.config.stages.length === 0) {
      throw new Error('Pipeline must have at least one stage');
    }
    
    // Check for duplicate stage IDs
    const stageIds = new Set<string>();
    for (const stage of this.config.stages) {
      if (stageIds.has(stage.id)) {
        throw new Error(`Duplicate stage ID: ${stage.id}`);
      }
      stageIds.add(stage.id);
    }
    
    // Validate dependencies exist
    for (const stage of this.config.stages) {
      if (stage.dependencies) {
        for (const dep of stage.dependencies) {
          if (!stageIds.has(dep)) {
            throw new Error(`Stage ${stage.id} depends on non-existent stage: ${dep}`);
          }
        }
      }
    }
  }
}

/**
 * Base stage executor interface
 */
abstract class StageExecutor {
  constructor(protected container: DIContainer) {}
  
  abstract execute(stage: PipelineStage, context: any): Promise<any>;
}

/**
 * Agent stage executor
 */
class AgentStageExecutor extends StageExecutor {
  async execute(stage: PipelineStage, context: any): Promise<any> {
    const { agentId, taskType, taskPayload } = stage.config;
    
    const agentFactory = this.container.get('agentFactory');
    const agent = agentFactory.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const task: AgentTask = {
      id: `task_${stage.id}_${Date.now()}`,
      type: taskType,
      payload: { ...taskPayload, ...context.input },
      priority: stage.config.priority || 0,
      timeout: stage.timeout,
      context: context.pipelineContext.metadata
    };
    
    const result = await agent.executeTask(task);
    
    if (!result.success) {
      throw result.error || new Error('Agent task failed');
    }
    
    return result.data;
  }
}

/**
 * Tool stage executor  
 */
class ToolStageExecutor extends StageExecutor {
  async execute(stage: PipelineStage, context: any): Promise<any> {
    const { toolName, toolConfig } = stage.config;
    
    const toolRegistry = this.container.get('toolRegistry');
    const tool = toolRegistry.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    return await tool.execute({
      ...toolConfig,
      input: context.input
    });
  }
}

/**
 * Validation stage executor
 */
class ValidationStageExecutor extends StageExecutor {
  async execute(stage: PipelineStage, context: any): Promise<any> {
    const { validationType, validationConfig } = stage.config;
    
    switch (validationType) {
      case 'schema':
        return this.validateSchema(context.input, validationConfig);
      case 'custom':
        return this.validateCustom(context.input, validationConfig);
      default:
        throw new Error(`Unknown validation type: ${validationType}`);
    }
  }
  
  private validateSchema(input: any, config: any): any {
    // Implement schema validation
    return { valid: true, input };
  }
  
  private validateCustom(input: any, config: any): any {
    // Implement custom validation
    return { valid: true, input };
  }
}

/**
 * Transformation stage executor
 */
class TransformationStageExecutor extends StageExecutor {
  async execute(stage: PipelineStage, context: any): Promise<any> {
    const { transformationType, transformationConfig } = stage.config;
    
    switch (transformationType) {
      case 'map':
        return this.mapTransform(context.input, transformationConfig);
      case 'filter':
        return this.filterTransform(context.input, transformationConfig);
      case 'aggregate':
        return this.aggregateTransform(context.input, transformationConfig);
      default:
        throw new Error(`Unknown transformation type: ${transformationType}`);
    }
  }
  
  private mapTransform(input: any, config: any): any {
    // Implement map transformation
    return input;
  }
  
  private filterTransform(input: any, config: any): any {
    // Implement filter transformation
    return input;
  }
  
  private aggregateTransform(input: any, config: any): any {
    // Implement aggregate transformation
    return input;
  }
}
