import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { ToolRegistry } from "@/lib/tools/core/ToolPlugin";
import { ProductivityPlugin } from "@/lib/tools/plugins/ProductivityPlugin";
import { AnswerPlugin } from "@/lib/tools/plugins/AnswerPlugin";
import { BrowsePlugin } from "@/lib/tools/plugins/BrowsePlugin";
import { ValidatorPlugin } from "@/lib/tools/plugins/ValidatorPlugin";
import { PlannerPlugin } from "@/lib/tools/plugins/PlannerPlugin";
import { EmptyPlugin } from "@/lib/tools/plugins/EmptyPlugin";
import { ClassificationPlugin } from "@/lib/tools/plugins/ClassificationPlugin";

export interface IToolSet {
  getName(): string;
  createTools(context: ExecutionContext): any[];
  getToolRegistry(): ToolRegistry;
}

export class ProductivityToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
    const plugin = new ProductivityPlugin();
    this.registry.registerAll(plugin.getTools(context));
  }
  
  getName(): string {
    return 'productivity';
  }
  
  createTools(context: ExecutionContext): any[] {
    const plugin = new ProductivityPlugin();
    return plugin.getTools(context);
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

export class AnswerToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
    const plugin = new AnswerPlugin();
    this.registry.registerAll(plugin.getTools(context));
  }
  
  getName(): string {
    return 'answer';
  }
  
  createTools(context: ExecutionContext): any[] {
    const plugin = new AnswerPlugin();
    return plugin.getTools(context);
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

export class BrowseToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
    const plugin = new BrowsePlugin();
    this.registry.registerAll(plugin.getTools(context));
  }
  
  getName(): string {
    return 'browse';
  }
  
  createTools(context: ExecutionContext): any[] {
    const plugin = new BrowsePlugin();
    return plugin.getTools(context);
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

export class ValidatorToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
    const plugin = new ValidatorPlugin();
    this.registry.registerAll(plugin.getTools(context));
  }
  
  getName(): string {
    return 'validator';
  }
  
  createTools(context: ExecutionContext): any[] {
    const plugin = new ValidatorPlugin();
    return plugin.getTools(context);
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

export class PlannerToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
    const plugin = new PlannerPlugin();
    this.registry.registerAll(plugin.getTools(context));
  }
  
  getName(): string {
    return 'planner';
  }
  
  createTools(context: ExecutionContext): any[] {
    const plugin = new PlannerPlugin();
    return plugin.getTools(context);
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

export class ClassificationToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
    const plugin = new ClassificationPlugin();
    this.registry.registerAll(plugin.getTools(context));
  }
  
  getName(): string {
    return 'classification';
  }
  
  createTools(context: ExecutionContext): any[] {
    const plugin = new ClassificationPlugin();
    return plugin.getTools(context);
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

export class EmptyToolSet implements IToolSet {
  private registry: ToolRegistry;
  
  constructor(context: ExecutionContext) {
    this.registry = new ToolRegistry(context);
  }
  
  getName(): string {
    return 'empty';
  }
  
  createTools(context: ExecutionContext): any[] {
    return [];
  }
  
  getToolRegistry(): ToolRegistry {
    return this.registry;
  }
}

// Tool Set Factory
export class ToolSetFactory {
  private static toolSets = new Map<string, (context: ExecutionContext) => IToolSet>([
    ['productivity', (ctx) => new ProductivityToolSet(ctx)],
    ['answer', (ctx) => new AnswerToolSet(ctx)],
    ['browse', (ctx) => new BrowseToolSet(ctx)],
    ['validator', (ctx) => new ValidatorToolSet(ctx)],
    ['planner', (ctx) => new PlannerToolSet(ctx)],
    ['classification', (ctx) => new ClassificationToolSet(ctx)],
    ['empty', (ctx) => new EmptyToolSet(ctx)]
  ]);
  
  static createToolSet(type: string, context: ExecutionContext): IToolSet {
    const factory = this.toolSets.get(type);
    if (!factory) {
      throw new Error(`Unknown tool set type: ${type}`);
    }
    return factory(context);
  }

  /**
   * Get all available tool set types
   */
  static getAvailableTypes(): string[] {
    return Array.from(this.toolSets.keys());
  }

  /**
   * Check if a tool set type is available
   */
  static hasType(type: string): boolean {
    return this.toolSets.has(type);
  }

  /**
   * Register a new tool set type
   */
  static registerToolSet(type: string, factory: (context: ExecutionContext) => IToolSet): void {
    this.toolSets.set(type, factory);
  }
}