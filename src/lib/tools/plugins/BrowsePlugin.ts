import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";

// Fix the imports - use the correct tool names that match your actual tool files
import { NavigationTool } from '@/lib/tools/browser-navigation/NavigationTool';
import { FindElementTool } from '@/lib/tools/browser-navigation/FindElementTool';
import { InteractionTool } from '@/lib/tools/browser-navigation/InteractionTool';
import { ScrollTool } from '@/lib/tools/browser-navigation/ScrollTool';
import { SearchTool } from '@/lib/tools/browser-navigation/SearchTool';
import { TabOperationsTool } from '@/lib/tools/tab/TabOperationsTool';
import { GetSelectedTabsTool } from "@/lib/tools/tab/GetSelectedTabsTool";
import { NoOpTool } from "@/lib/tools/utility/NoOpTool";
import { TerminateTool } from "@/lib/tools/utility/TerminateTool";

// Add any missing tools you need
import { ExtractTool } from '@/lib/tools/answer/ExtractTool';
import { DoneTool } from '@/lib/tools/utility/DoneTool';
import { WaitTool } from '@/lib/tools/utility/WaitTool';

export class BrowsePlugin implements IToolPlugin {
  readonly name = 'browse';
  readonly description = 'Web browsing and navigation tools for interacting with web pages';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [
      // Navigation and interaction - use the correct class names
      new NavigationTool(context),        // was NavigateTool
      new SearchTool(context),           // was SearchTextTool  
      new InteractionTool(context),      // was InteractTool
      new ScrollTool(context),
      new FindElementTool(context),      // add if you have screenshots
      
      // Tab operations
      new GetSelectedTabsTool(context),
      new TabOperationsTool(context),
      
      // Utility
      new NoOpTool(context),
      new TerminateTool(context),
      new DoneTool(context),
      new WaitTool(context),
      
      // Answer tools
      new ExtractTool(context),
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