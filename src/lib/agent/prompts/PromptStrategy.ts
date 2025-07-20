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
}

export class ProductivityPromptStrategy implements IPromptStrategy {
  constructor(private toolDocs: string) {}
  
  generateSystemPrompt(): string {
    return new ProductivityAgentPrompt(this.toolDocs).generate();
  }
  
  generateUserPrompt(instruction: string): string {
    return instruction; // Simple pass-through for productivity
  }
}

export class AnswerPromptStrategy implements IPromptStrategy {
  generateSystemPrompt(followUpContext?: any): string {
    return `You are a web content analysis expert specialized in extracting and analyzing information from web pages.
    
Your primary responsibilities:
1. Extract relevant information from web content
2. Analyze and summarize content based on user queries
3. Provide accurate, concise answers based on the available data
4. Handle follow-up questions and clarifications

Always be precise and cite specific information when available.`;
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
  constructor(private toolDocs: string) {}
  
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
  static createStrategy(agentType: string, toolDocs?: string): IPromptStrategy {
    switch (agentType) {
      case 'productivity':
        return new ProductivityPromptStrategy(toolDocs || '');
      case 'answer':
        return new AnswerPromptStrategy();
      case 'validator':
        return new ValidatorPromptStrategy();
      case 'planner':
        return new PlannerPromptStrategy();
      case 'browse':
        return new BrowsePromptStrategy(toolDocs || '');
      case 'intent-prediction':
        return new IntentPredictionPromptStrategy();
      case 'classification':
        return new ClassificationPromptStrategy();
      default:
        throw new Error(`Unknown prompt strategy: ${agentType}`);
    }
  }
}