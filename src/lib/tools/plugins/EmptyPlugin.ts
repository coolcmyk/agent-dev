import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { IToolPlugin } from "../core/ToolPlugin";

export class EmptyPlugin implements IToolPlugin {
  readonly name = 'empty';
  readonly description = 'Empty plugin for agents that do not require tools';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];

  getTools(context: ExecutionContext): any[] {
    return [];
  }

  getCategory(): string {
    return 'empty';
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