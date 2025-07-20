import { IToolPlugin, ITool, ToolRegistry } from '../core/ToolPlugin';
import { z } from 'zod';

/**
 * Answer Plugin
 * Provides tools for content extraction and analysis
 */
export class AnswerPlugin implements IToolPlugin {
  readonly name = 'answer';
  readonly version = '1.0.0';
  readonly category = 'analysis';
  readonly dependencies: string[] = [];
  
  async install(registry: ToolRegistry): Promise<void> {
    console.log('Installing Answer Plugin');
  }
  
  async uninstall(registry: ToolRegistry): Promise<void> {
    console.log('Uninstalling Answer Plugin');
  }
  
  getTools(): ITool[] {
    return [
      new ExtractToolWrapper(),
      new RefreshBrowserStateToolWrapper(),
    ];
  }
}

/**
 * Wrapper for ExtractTool
 */
class ExtractToolWrapper implements ITool {
  readonly name = 'extract';
  readonly description = 'Extract text content or links from web pages';
  readonly category = 'analysis';
  
  readonly schema = z.object({
    tab_ids: z.array(z.number()),
    extract_type: z.enum(['text', 'links']),
    context: z.enum(['visible', 'full']).optional(),
    sections: z.array(z.string()).optional(),
    include_metadata: z.boolean().default(true),
    max_length: z.number().optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { ExtractTool } = await import('../answer/ExtractTool');
    const tool = new ExtractTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for RefreshBrowserStateTool
 */
class RefreshBrowserStateToolWrapper implements ITool {
  readonly name = 'refresh_browser_state';
  readonly description = 'Refresh the current browser state and get updated page information';
  readonly category = 'analysis';
  
  readonly schema = z.object({
    force_refresh: z.boolean().default(false),
  });
  
  async _call(input: any): Promise<string> {
    const { RefreshBrowserStateTool } = await import('../utility/RefreshBrowserStateTool');
    const tool = new RefreshBrowserStateTool();
    return tool._call(input);
  }
}
