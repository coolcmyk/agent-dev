import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";
import { 
  TabOperationsTool,
  GroupTabsTool,
  GetSelectedTabsTool 
} from "../tab";
import { 
  SaveBookmarkTool,
  BookmarkManagementTool,
  BookmarkSearchTool,
  BookmarksFolderTool
} from "../bookmarks";
import { 
  SessionManagementTool, 
  SessionExecutionTool 
} from "../sessions";
import { 
  NoOpTool, 
  TerminateTool, 
  GetDateTool 
} from "../utility";
import { 
  GetHistoryTool, 
  StatsHistoryTool 
} from "../history";

export class ProductivityPlugin implements IToolPlugin {
  readonly name = 'productivity';
  readonly description = 'Productivity tools for tab management, bookmarks, sessions, and browser efficiency';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [
      // Tab Management
      new TabOperationsTool(context),
      new GroupTabsTool(context),
      new GetSelectedTabsTool(context),

      // Bookmark Management
      new SaveBookmarkTool(context),
      new BookmarkManagementTool(context),
      new BookmarkSearchTool(context),
      new BookmarksFolderTool(context),

      // Session Management
      new SessionManagementTool(context),
      new SessionExecutionTool(context),

      // History
      new GetHistoryTool(context),
      new StatsHistoryTool(context),

      // Utility
      new NoOpTool(context),
      new TerminateTool(context),
      new GetDateTool(context),
    ];
  }

  getCategory(): string {
    return 'productivity';
  }

  isEnabled(): boolean {
    return true;
  }

  async initialize(): Promise<void> {
    // Any initialization logic if needed
  }

  async cleanup(): Promise<void> {
    // Any cleanup logic if needed
  }
}