import { z } from 'zod';
import { IPlugin } from '../../core/interfaces';

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
 * Tool plugin interface
 */
export interface IToolPlugin extends IPlugin {
  readonly category: string;
  getTools(): ITool[];
}

/**
 * Tool registry with plugin support
 */
export class ToolRegistry {
  private tools = new Map<string, ITool>();
  private plugins = new Map<string, IToolPlugin>();
  private toolCategories = new Map<string, ITool[]>();
  private dependencies = new Map<string, string[]>();
  
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
      await plugin.install(this);
      this.plugins.set(plugin.name, plugin);
      
      // Register tools from plugin
      const tools = plugin.getTools();
      this.registerToolsInCategory(plugin.category, tools);
      
      console.log(`✅ Installed plugin: ${plugin.name} with ${tools.length} tools`);
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
      await plugin.uninstall(this);
      
      // Remove tools from registry
      const tools = plugin.getTools();
      for (const tool of tools) {
        this.tools.delete(tool.name);
        
        // Remove from category
        const categoryTools = this.toolCategories.get(plugin.category) || [];
        const filtered = categoryTools.filter(t => t.name !== tool.name);
        this.toolCategories.set(plugin.category, filtered);
      }
      
      this.plugins.delete(pluginName);
      console.log(`✅ Uninstalled plugin: ${pluginName}`);
    } catch (error) {
      console.error(`❌ Failed to uninstall plugin ${pluginName}:`, error);
      throw error;
    }
  }
  
  /**
   * Register tools in a specific category
   */
  registerToolsInCategory(category: string, tools: ITool[]): void {
    const existing = this.toolCategories.get(category) || [];
    this.toolCategories.set(category, [...existing, ...tools]);
    
    // Also register in main registry
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }
  
  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ITool[] {
    return this.toolCategories.get(category) || [];
  }
  
  /**
   * Get all tools
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get tool by name
   */
  getTool(name: string): ITool | undefined {
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
    return this.getAll().map(tool => {
      // Convert to LangChain tool format
      return {
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        func: tool._call.bind(tool)
      };
    });
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
