import { z } from 'zod';
import { NxtscapeTool } from './NxtscapeTool';
import { ToolCategory } from './ToolConfig';
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";

/**
 * Registry for managing tools
 */
export class ToolRegistry {
  private tools: Map<string, NxtscapeTool> = new Map();
  private toolsByCategory: Map<ToolCategory, NxtscapeTool[]> = new Map();
  private context: ExecutionContext;
  
  // ✅ Cache expensive operations
  private _langChainToolsCache: any[] | null = null;
  private _systemPromptCache: string | null = null;

  constructor(context: ExecutionContext) {
    this.context = context;
  }
  /**
   * Register a tool
   */
  register(tool: NxtscapeTool): void {
    const config = tool.getConfig();
    
    // Add to main registry
    this.tools.set(config.name, tool);
    
    // Add to category index
    if (!this.toolsByCategory.has(config.category)) {
      this.toolsByCategory.set(config.category, []);
    }
    this.toolsByCategory.get(config.category)!.push(tool);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: NxtscapeTool[]): void {
    tools.forEach(tool => this.register(tool));
    // ✅ Invalidate caches when tools change
    this._langChainToolsCache = null;
    this._systemPromptCache = null;
  }

  /**
   * Get a tool by name
   */
  getByName(name: string): NxtscapeTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): NxtscapeTool[] {
    return this.toolsByCategory.get(category) || [];
  }

  /**
   * Get all tools
   */
  getAll(): NxtscapeTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all LangChain tools
   */
  getLangChainTools() {
    if (this._langChainToolsCache === null) {
      this._langChainToolsCache = this.getAll().map(tool => tool.getLangChainTool());
    }
    return this._langChainToolsCache;
  }

  /**
   * Generate system prompt for tools
   */
  generateSystemPrompt(categories?: ToolCategory[]): string {
    const cacheKey = categories?.join(',') || 'all';
    if (this._systemPromptCache === null) {
      this._systemPromptCache = this._generateSystemPromptUncached(categories);
    }
    return this._systemPromptCache;
  }

  private _generateSystemPromptUncached(categories?: ToolCategory[]): string {
    // Your existing implementation
    const tools = categories 
      ? categories.flatMap(cat => this.getByCategory(cat))
      : this.getAll();

    if (tools.length === 0) {
      return "## Available Tools\n\nNo tools available for this agent.";
    }

    const toolDocs = tools.map(tool => {
      const config = tool.getConfig();
      const inputSchema = this.zodSchemaToString(config.inputSchema);
      const outputSchema = this.zodSchemaToString(config.outputSchema);
      
      let doc = `### ${config.name}\n`;
      doc += `**Category**: ${config.category}\n`;
      doc += `**Description**: ${config.description}\n`;
      doc += `**Input Schema**:\n\`\`\`json\n${inputSchema}\n\`\`\`\n`;
      doc += `**Output Schema**:\n\`\`\`json\n${outputSchema}\n\`\`\`\n`;
      
      if (config.examples && config.examples.length > 0) {
        doc += `**Examples**:\n`;
        config.examples.forEach((example, i) => {
          doc += `${i + 1}. ${example.description}\n`;
          doc += `   Input: \`${JSON.stringify(example.input)}\`\n`;
          doc += `   Output: \`${JSON.stringify(example.output)}\`\n`;
        });
      }
      
      return doc;
    }).join('\n---\n\n');

    return `## Available Tools\n\n${toolDocs}`;
  }

  /**
   * Convert Zod schema to readable string representation
   */
  private zodSchemaToString(schema: z.ZodType): string {
    // This is a simplified version - you might want to enhance this
    // to provide better schema documentation
    try {
      // For now, return a simple JSON representation
      // In a real implementation, you'd want to introspect the schema
      return JSON.stringify(schema._def, null, 2);
    } catch {
      return 'Schema details available at runtime';
    }
  }

  /**
   * Validate tool compatibility
   */
  validateCompatibility(requiredVersion: string): boolean {
    // Simple version check - could be enhanced
    return this.getAll().every(tool => {
      const version = tool.getConfig().version;
      return version >= requiredVersion;
    });
  }
}