import { IToolPlugin, ITool, ToolRegistry } from '../core/ToolPlugin';
import { z } from 'zod';

/**
 * Browser Navigation Plugin
 * Provides tools for web navigation, interaction, and page manipulation
 */
export class BrowserNavigationPlugin implements IToolPlugin {
  readonly name = 'browser-navigation';
  readonly version = '1.0.0';
  readonly category = 'navigation';
  readonly dependencies: string[] = [];
  
  async install(registry: ToolRegistry): Promise<void> {
    // Tools will be registered automatically via getTools()
    console.log('Installing Browser Navigation Plugin');
  }
  
  async uninstall(registry: ToolRegistry): Promise<void> {
    console.log('Uninstalling Browser Navigation Plugin');
  }
  
  getTools(): ITool[] {
    return [
      new NavigationToolWrapper(),
      new InteractionToolWrapper(),
      new ScrollToolWrapper(),
      new FindElementToolWrapper(),
      new SearchToolWrapper(),
    ];
  }
}

/**
 * Wrapper for NavigationTool to make it plugin-compatible
 */
class NavigationToolWrapper implements ITool {
  readonly name = 'navigate';
  readonly description = 'Navigate to a URL or perform browser navigation actions';
  readonly category = 'navigation';
  
  readonly schema = z.object({
    action: z.enum(['navigate', 'back', 'forward', 'refresh']),
    url: z.string().optional(),
  });
  
  async _call(input: any): Promise<string> {
    // Import the actual tool dynamically to avoid circular dependencies
    const { NavigationTool } = await import('../browser-navigation/NavigationTool');
    const tool = new NavigationTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for InteractionTool
 */
class InteractionToolWrapper implements ITool {
  readonly name = 'interact';
  readonly description = 'Click elements, type text, or perform other interactions';
  readonly category = 'navigation';
  
  readonly schema = z.object({
    action: z.enum(['click', 'type', 'clear', 'press', 'select']),
    nodeId: z.number().optional(),
    text: z.string().optional(),
    key: z.string().optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { InteractionTool } = await import('../browser-navigation/InteractionTool');
    const tool = new InteractionTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for ScrollTool
 */
class ScrollToolWrapper implements ITool {
  readonly name = 'scroll';
  readonly description = 'Scroll the page up, down, or to specific elements';
  readonly category = 'navigation';
  
  readonly schema = z.object({
    direction: z.enum(['up', 'down', 'to_element']),
    nodeId: z.number().optional(),
    amount: z.number().optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { ScrollTool } = await import('../browser-navigation/ScrollTool');
    const tool = new ScrollTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for FindElementTool
 */
class FindElementToolWrapper implements ITool {
  readonly name = 'find_element';
  readonly description = 'Find elements on the page by text, attributes, or other criteria';
  readonly category = 'navigation';
  
  readonly schema = z.object({
    query: z.string(),
    element_type: z.enum(['clickable', 'typeable', 'any']).optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { FindElementTool } = await import('../browser-navigation/FindElementTool');
    const tool = new FindElementTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for SearchTool
 */
class SearchToolWrapper implements ITool {
  readonly name = 'search';
  readonly description = 'Search on the current page or navigate to search engines';
  readonly category = 'navigation';
  
  readonly schema = z.object({
    query: z.string(),
    engine: z.enum(['google', 'current_page']).optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { SearchTool } = await import('../browser-navigation/SearchTool');
    const tool = new SearchTool();
    return tool._call(input);
  }
}
