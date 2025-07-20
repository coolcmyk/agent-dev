import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";
import { 
  NavigateTool,
  SearchTextTool,
  InteractTool,
  ScrollTool,
  TakeScreenshotTool
} from "../browser";
import { GetSelectedTabsTool } from "../tab";
import { NoOpTool, TerminateTool } from "../utility";

export class BrowsePlugin implements IToolPlugin {
  readonly name = 'browse';
  readonly description = 'Web browsing and navigation tools for interacting with web pages';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [
      // Navigation and interaction
      new NavigateTool(context),
      new SearchTextTool(context),
      new InteractTool(context),
      new ScrollTool(context),
      new TakeScreenshotTool(context),
      
      // Tab operations
      new GetSelectedTabsTool(context),
      
      // Utility
      new NoOpTool(context),
      new TerminateTool(context),
    ];
  }

  getCategory(): string {
    return 'browse';
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