import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";
import { ExtractTool } from "../answer";
import { GetSelectedTabsTool } from "../tab";
import { NoOpTool, TerminateTool } from "../utility";

export class ValidatorPlugin implements IToolPlugin {
  readonly name = 'validator';
  readonly description = 'Validation tools for checking task completion and results';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [
      // Content extraction for validation
      new ExtractTool(context),
      new GetSelectedTabsTool(context),
      
      // Utility
      new NoOpTool(context),
      new TerminateTool(context),
    ];
  }

  getCategory(): string {
    return 'validator';
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