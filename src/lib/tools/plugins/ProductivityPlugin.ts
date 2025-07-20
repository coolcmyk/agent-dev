import { IToolPlugin, ITool, ToolRegistry } from '../core/ToolPlugin';
import { z } from 'zod';

/**
 * Productivity Plugin
 * Provides tools for tab management, bookmarks, sessions, and productivity features
 */
export class ProductivityPlugin implements IToolPlugin {
  readonly name = 'productivity';
  readonly version = '1.0.0';
  readonly category = 'productivity';
  readonly dependencies: string[] = [];
  
  async install(registry: ToolRegistry): Promise<void> {
    console.log('Installing Productivity Plugin');
  }
  
  async uninstall(registry: ToolRegistry): Promise<void> {
    console.log('Uninstalling Productivity Plugin');
  }
  
  getTools(): ITool[] {
    return [
      new TabManagementToolWrapper(),
      new BookmarkToolWrapper(),
      new SessionToolWrapper(),
      new HistoryToolWrapper(),
    ];
  }
}

/**
 * Wrapper for Tab Management Tools
 */
class TabManagementToolWrapper implements ITool {
  readonly name = 'manage_tabs';
  readonly description = 'Manage browser tabs - switch, close, organize, group';
  readonly category = 'productivity';
  
  readonly schema = z.object({
    action: z.enum(['switch', 'close', 'group', 'ungroup', 'list', 'duplicate']),
    tab_id: z.number().optional(),
    tab_ids: z.array(z.number()).optional(),
    group_name: z.string().optional(),
    group_color: z.string().optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { TabManagementTool } = await import('../tab/TabManagementTool');
    const tool = new TabManagementTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for Bookmark Tools
 */
class BookmarkToolWrapper implements ITool {
  readonly name = 'manage_bookmarks';
  readonly description = 'Manage bookmarks - create, search, organize, delete';
  readonly category = 'productivity';
  
  readonly schema = z.object({
    action: z.enum(['create', 'search', 'delete', 'move', 'list']),
    title: z.string().optional(),
    url: z.string().optional(),
    folder: z.string().optional(),
    query: z.string().optional(),
    bookmark_id: z.string().optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { BookmarkTool } = await import('../bookmarks/BookmarkTool');
    const tool = new BookmarkTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for Session Tools
 */
class SessionToolWrapper implements ITool {
  readonly name = 'manage_sessions';
  readonly description = 'Manage browser sessions - save, restore, list';
  readonly category = 'productivity';
  
  readonly schema = z.object({
    action: z.enum(['save', 'restore', 'delete', 'list']),
    session_name: z.string().optional(),
    session_id: z.string().optional(),
  });
  
  async _call(input: any): Promise<string> {
    const { SessionTool } = await import('../sessions/SessionTool');
    const tool = new SessionTool();
    return tool._call(input);
  }
}

/**
 * Wrapper for History Tools
 */
class HistoryToolWrapper implements ITool {
  readonly name = 'search_history';
  readonly description = 'Search browser history for previously visited pages';
  readonly category = 'productivity';
  
  readonly schema = z.object({
    query: z.string(),
    start_time: z.number().optional(),
    end_time: z.number().optional(),
    max_results: z.number().default(10),
  });
  
  async _call(input: any): Promise<string> {
    const { HistoryTool } = await import('../history/HistoryTool');
    const tool = new HistoryTool();
    return tool._call(input);
  }
}
