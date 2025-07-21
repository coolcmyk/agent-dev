import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { 
    ProductivityAgentPrompt,
    BrowseAgentPrompt,
    IntentPredictionPrompt,
    PlannerToolPrompt,
    ValidatorToolPrompt
} from '@/lib/prompts';

export interface IPromptStrategy {
  generateSystemPrompt(context?: any): string;
  generateUserPrompt(instruction: string, context?: any): string;
  updateToolDocs?(toolDocs: string): void; // Optional method to update tool docs
}

export class ProductivityPromptStrategy implements IPromptStrategy {
  constructor(private toolDocs: string = '') {}
  
  updateToolDocs(toolDocs: string): void {
    this.toolDocs = toolDocs;
  }
  
  generateSystemPrompt(): string {
    return new ProductivityAgentPrompt(this.toolDocs).generate();
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

export class AnswerPromptStrategy implements IPromptStrategy {
  private toolDocs: string = '';
  
  updateToolDocs(toolDocs: string): void {
    this.toolDocs = toolDocs;
  }
  
  generateSystemPrompt(followUpContext?: any): string {
    const basePrompt = `You are a web content analysis expert specialized in extracting and analyzing information from web pages.
    
Your primary responsibilities:
1. Extract relevant information from web content
2. Analyze and summarize content based on user queries
3. Provide accurate, concise answers based on the available data
4. Handle follow-up questions and clarifications

Always be precise and cite specific information when available.`;

    // Include tool docs if available
    const toolSection = this.toolDocs ? `\n\n## AVAILABLE TOOLS\n${this.toolDocs}` : '';
    
    return basePrompt + toolSection;
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

export class ValidatorPromptStrategy implements IPromptStrategy {
  generateSystemPrompt(): string {
    return new ValidatorToolPrompt().generate();
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

export class PlannerPromptStrategy implements IPromptStrategy {
  generateSystemPrompt(): string {
    return new PlannerToolPrompt().generate();
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

export class BrowsePromptStrategy implements IPromptStrategy {
  constructor(private toolDocs: string = '') {}
  
  updateToolDocs(toolDocs: string): void {
    this.toolDocs = toolDocs;
  }
  
  generateSystemPrompt(): string {
    return new BrowseAgentPrompt(this.toolDocs).generate();
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

export class IntentPredictionPromptStrategy implements IPromptStrategy {
  generateSystemPrompt(): string {
    return new IntentPredictionPrompt().generate();
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

export class ClassificationPromptStrategy implements IPromptStrategy {
  generateSystemPrompt(): string {
    return `You are a task classification expert. Your job is to analyze user instructions and classify them into one of these categories:
    
- 'productivity': Tasks related to tab management, bookmarks, browser organization
- 'browse': Tasks related to web navigation, searching, content interaction
- 'answer': Tasks related to content extraction, analysis, and information retrieval

Respond with a JSON object containing the task_type.`;
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction;
  }
}

// Prompt Strategy Factory
export class PromptStrategyFactory {
  private static cache = new Map<string, IPromptStrategy>();
  
  static createStrategy(agentType: string, toolDocs?: string): IPromptStrategy {
    const cacheKey = `${agentType}:${toolDocs || 'default'}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    let strategy: IPromptStrategy;
    switch (agentType) {
      case 'productivity':
        strategy = new ProductivityPromptStrategy(toolDocs || '');
        break;
      case 'answer':
        strategy = new AnswerPromptStrategy();
        break;
      case 'validator':
        strategy = new ValidatorPromptStrategy();
        break;
      case 'planner':
        strategy = new PlannerPromptStrategy();
        break;
      case 'browse':
        strategy = new BrowsePromptStrategy(toolDocs || '');
        break;
      case 'intent-prediction':
        strategy = new IntentPredictionPromptStrategy();
        break;
      case 'classification':
        strategy = new ClassificationPromptStrategy();
        break;
      default:
        throw new Error(`Unknown prompt strategy: ${agentType}`);
    }
    
    this.cache.set(cacheKey, strategy);
    return strategy;
  }
  
  static clearCache(): void {
    this.cache.clear();
  }
}