import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";

export class ClassificationPlugin implements IToolPlugin {
  readonly name = 'classification';
  readonly description = 'Classification tools for task categorization';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    // Classification agents typically don't need tools
    return [];
  }

  getCategory(): string {
    return 'classification';
  }

  isEnabled(): boolean {
    return true;
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}