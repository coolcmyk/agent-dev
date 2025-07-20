import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";
import { ExtractTool } from "../answer";
import { GetSelectedTabsTool } from "../tab";

/**
 * Answer Plugin
 * Provides tools for content extraction and analysis
 */
export class AnswerPlugin implements IToolPlugin {
  readonly name = 'answer';
  readonly description = 'Content analysis and extraction tools for answering questions about web pages';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [
      new ExtractTool(context),
      new GetSelectedTabsTool(context)
    ];
  }

  getCategory(): string {
    return 'answer';
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