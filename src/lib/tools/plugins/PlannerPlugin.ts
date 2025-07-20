import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";
import { GetSelectedTabsTool } from "../tab";
import { NoOpTool, TerminateTool, GetDateTool } from "../utility";

export class PlannerPlugin implements IToolPlugin {
  readonly name = 'planner';
  readonly description = 'Planning and task breakdown tools';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [
      // Context gathering
      new GetSelectedTabsTool(context),
      
      // Utility
      new NoOpTool(context),
      new TerminateTool(context),
      new GetDateTool(context),
    ];
  }

  getCategory(): string {
    return 'planner';
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