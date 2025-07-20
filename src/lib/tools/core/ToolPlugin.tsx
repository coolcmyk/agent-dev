import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Tool interface for the plugin system
 */
export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  schema: z.ZodSchema<any>;
  
  _call(input: any): Promise<string>;
}

/**
 * Base plugin interface
 */
export interface IPlugin {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly dependencies: string[];
  
  isEnabled(): boolean;
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Tool plugin interface - extends IPlugin and provides tools
 */
export interface IToolPlugin extends IPlugin {
  getTools(context: ExecutionContext): any[]; // Returns actual tool instances
  getCategory?(): string; // Optional category
}

/**
 * Enhanced Tool registry with plugin support
 */
export class ToolRegistry {
  private tools = new Map<string, any>(); // Store actual tool instances
  private plugins = new Map<string, IToolPlugin>();
  private toolCategories = new Map<string, any[]>();
  private context: ExecutionContext;
  
  constructor(context?: ExecutionContext) {
    this.context = context!;
  }
  
  /**
   * Register multiple tools at once
   */
  registerAll(tools: any[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }
  
  /**
   * Register a single tool
   */
  register(tool: any): void {
    if (!tool || !tool.name) {
      throw new Error('Tool must have a name property');
    }
    
    this.tools.set(tool.name, tool);
    
    // Categorize tool if it has a category
    if (tool.category) {
      const existing = this.toolCategories.get(tool.category) || [];
      this.toolCategories.set(tool.category, [...existing, tool]);
    }
  }
  
  /**
   * Install a tool plugin
   */
  async installPlugin(plugin: IToolPlugin): Promise<void> {
    // Check dependencies
    for (const dep of plugin.dependencies) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Missing dependency: ${dep} for plugin: ${plugin.name}`);
      }
    }
    
    try {
      await plugin.initialize();
      this.plugins.set(plugin.name, plugin);
      
      // Register tools from plugin
      if (this.context) {
        const tools = plugin.getTools(this.context);
        this.registerAll(tools);
        console.log(`✅ Installed plugin: ${plugin.name} with ${tools.length} tools`);
      }
    } catch (error) {
      console.error(`❌ Failed to install plugin ${plugin.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Uninstall a tool plugin
   */
  async uninstallPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }
    
    try {
      await plugin.cleanup();
      
      // Remove tools from registry
      if (this.context) {
        const tools = plugin.getTools(this.context);
        for (const tool of tools) {
          this.tools.delete(tool.name);
          
          // Remove from category
          if (tool.category) {
            const categoryTools = this.toolCategories.get(tool.category) || [];
            const filtered = categoryTools.filter(t => t.name !== tool.name);
            this.toolCategories.set(tool.category, filtered);
          }
        }
      }
      
      this.plugins.delete(pluginName);
      console.log(`✅ Uninstalled plugin: ${pluginName}`);
    } catch (error) {
      console.error(`❌ Failed to uninstall plugin ${pluginName}:`, error);
      throw error;
    }
  }
  
  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): any[] {
    return this.toolCategories.get(category) || [];
  }
  
  /**
   * Get all tools
   */
  getAll(): any[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get tool by name
   */
  getTool(name: string): any | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.toolCategories.keys());
  }
  
  /**
   * Get LangChain compatible tools
   */
  getLangChainTools(): any[] {
    return this.getAll(); // Return actual tool instances
  }
  
  /**
   * Generate system prompt from all tools
   */
  generateSystemPrompt(): string {
    const tools = this.getAll();
    if (tools.length === 0) {
      return '';
    }
    
    const toolDescriptions = tools.map(tool => {
      const name = tool.name || 'unknown';
      const description = tool.description || 'No description available';
      return `- ${name}: ${description}`;
    }).join('\n');
    
    return `Available tools:\n${toolDescriptions}`;
  }
  
  /**
   * Get installed plugins
   */
  getInstalledPlugins(): IToolPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Check if plugin is installed
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }
  
  /**
   * Get plugin statistics
   */
  getStats(): {
    totalTools: number;
    totalPlugins: number;
    toolsByCategory: Record<string, number>;
  } {
    const toolsByCategory: Record<string, number> = {};
    
    for (const [category, tools] of this.toolCategories) {
      toolsByCategory[category] = tools.length;
    }
    
    return {
      totalTools: this.tools.size,
      totalPlugins: this.plugins.size,
      toolsByCategory
    };
  }
}
