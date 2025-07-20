/**
 * Web Navigation Capability
 * 
 * Provides web browsing and navigation functionality for agents
 */

import { 
  AgentCapability, 
  AgentCapabilityConfig, 
  AgentCapabilityRequest, 
  AgentCapabilityResponse 
} from '../core/AgentCapability';
import { DIContainer } from '../../core/DIContainer';

export interface WebNavigationConfig extends AgentCapabilityConfig {
  browserSettings?: {
    headless?: boolean;
    timeout?: number;
    userAgent?: string;
  };
  navigationLimits?: {
    maxRedirects?: number;
    maxDepth?: number;
    allowedDomains?: string[];
  };
}

export interface NavigationRequest {
  url: string;
  action: 'navigate' | 'click' | 'scroll' | 'wait' | 'extract';
  selector?: string;
  waitFor?: string | number;
  options?: Record<string, any>;
}

export interface NavigationResult {
  url: string;
  title: string;
  content?: string;
  screenshot?: string;
  elements?: any[];
  status: 'success' | 'error' | 'timeout';
}

export class WebNavigationCapability extends AgentCapability<WebNavigationConfig> {
  private browserContext: any; // Will be injected

  protected async initializeCapability(): Promise<void> {
    this.browserContext = this.container.get('browserContext');
    this.logger.info('Web navigation capability initialized');
  }

  canHandle(request: AgentCapabilityRequest): boolean {
    return request.type === 'web.navigation' || 
           request.type === 'web.interact' ||
           request.type === 'web.extract';
  }

  async execute<NavigationRequest, NavigationResult>(
    request: AgentCapabilityRequest<NavigationRequest>
  ): Promise<AgentCapabilityResponse<NavigationResult>> {
    try {
      const { url, action, selector, waitFor, options = {} } = request.payload as any;
      
      this.logger.debug(`Executing web navigation: ${action} on ${url}`);
      
      // Get or create browser page
      const page = await this.browserContext.getPage();
      
      let result: any = {
        url: page.url(),
        title: '',
        status: 'success'
      };

      switch (action) {
        case 'navigate':
          await page.goto(url, options);
          result.title = await page.title();
          break;
          
        case 'click':
          if (!selector) throw new Error('Selector required for click action');
          await page.click(selector, options);
          break;
          
        case 'scroll':
          await page.evaluate((options) => {
            window.scrollBy(options.x || 0, options.y || 100);
          }, options);
          break;
          
        case 'wait':
          if (typeof waitFor === 'string') {
            await page.waitForSelector(waitFor, options);
          } else {
            await page.waitForTimeout(waitFor as number);
          }
          break;
          
        case 'extract':
          if (selector) {
            result.elements = await page.$$eval(selector, (elements) => 
              elements.map(el => ({
                text: el.textContent,
                html: el.innerHTML,
                attrs: Array.from(el.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {} as Record<string, string>)
              }))
            );
          } else {
            result.content = await page.content();
          }
          break;
          
        default:
          throw new Error(`Unknown navigation action: ${action}`);
      }

      // Update current state
      result.url = page.url();
      result.title = await page.title();

      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      this.logger.error('Web navigation failed:', error);
      return this.createErrorResponse(request.id, error as Error);
    }
  }
}

/**
 * Content Analysis Capability
 * 
 * Provides content extraction and analysis functionality
 */
export interface ContentAnalysisConfig extends AgentCapabilityConfig {
  analysisSettings?: {
    extractText?: boolean;
    extractImages?: boolean;
    extractLinks?: boolean;
    summarize?: boolean;
  };
  llmSettings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AnalysisRequest {
  content: string;
  type: 'text' | 'html' | 'url';
  analysisType: 'extract' | 'summarize' | 'classify' | 'sentiment';
  options?: Record<string, any>;
}

export interface AnalysisResult {
  originalContent: string;
  extractedText?: string;
  summary?: string;
  classification?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  entities?: any[];
  metadata?: Record<string, any>;
}

export class ContentAnalysisCapability extends AgentCapability<ContentAnalysisConfig> {
  private llmClient: any; // Will be injected

  protected async initializeCapability(): Promise<void> {
    this.llmClient = this.container.get('llmClient');
    this.logger.info('Content analysis capability initialized');
  }

  canHandle(request: AgentCapabilityRequest): boolean {
    return request.type === 'content.analysis' || 
           request.type === 'content.extract' ||
           request.type === 'content.summarize';
  }

  async execute<AnalysisRequest, AnalysisResult>(
    request: AgentCapabilityRequest<AnalysisRequest>
  ): Promise<AgentCapabilityResponse<AnalysisResult>> {
    try {
      const { content, type, analysisType, options = {} } = request.payload as any;
      
      this.logger.debug(`Analyzing content: ${analysisType} for ${type}`);
      
      let processedContent = content;
      
      // Preprocess content based on type
      if (type === 'html') {
        processedContent = this.extractTextFromHtml(content);
      } else if (type === 'url') {
        // Would fetch content from URL
        processedContent = await this.fetchContentFromUrl(content);
      }

      const result: any = {
        originalContent: content,
        extractedText: processedContent
      };

      // Perform analysis based on type
      switch (analysisType) {
        case 'extract':
          // Text is already extracted
          break;
          
        case 'summarize':
          result.summary = await this.summarizeContent(processedContent, options);
          break;
          
        case 'classify':
          result.classification = await this.classifyContent(processedContent, options);
          break;
          
        case 'sentiment':
          result.sentiment = await this.analyzeSentiment(processedContent, options);
          break;
          
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }

      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      this.logger.error('Content analysis failed:', error);
      return this.createErrorResponse(request.id, error as Error);
    }
  }

  private extractTextFromHtml(html: string): string {
    // Simple HTML text extraction (in real implementation, use proper parser)
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async fetchContentFromUrl(url: string): Promise<string> {
    // Would implement URL fetching
    throw new Error('URL fetching not implemented');
  }

  private async summarizeContent(content: string, options: any): Promise<string> {
    const prompt = `Summarize the following content:\n\n${content}`;
    const response = await this.llmClient.generate(prompt, {
      maxTokens: options.maxTokens || 200,
      temperature: options.temperature || 0.7
    });
    return response.text;
  }

  private async classifyContent(content: string, options: any): Promise<string[]> {
    const categories = options.categories || ['news', 'blog', 'documentation', 'marketing'];
    const prompt = `Classify the following content into one or more of these categories: ${categories.join(', ')}\n\nContent: ${content}`;
    
    const response = await this.llmClient.generate(prompt, {
      maxTokens: 100,
      temperature: 0.3
    });
    
    return response.text.split(',').map((cat: string) => cat.trim());
  }

  private async analyzeSentiment(content: string, options: any): Promise<'positive' | 'negative' | 'neutral'> {
    const prompt = `Analyze the sentiment of the following content. Respond with only one word: positive, negative, or neutral.\n\nContent: ${content}`;
    
    const response = await this.llmClient.generate(prompt, {
      maxTokens: 10,
      temperature: 0.1
    });
    
    const sentiment = response.text.toLowerCase().trim();
    return ['positive', 'negative', 'neutral'].includes(sentiment) 
      ? sentiment as any 
      : 'neutral';
  }
}

/**
 * Task Planning Capability
 * 
 * Provides task decomposition and planning functionality
 */
export interface TaskPlanningConfig extends AgentCapabilityConfig {
  planningSettings?: {
    maxSteps?: number;
    allowParallel?: boolean;
    retryCount?: number;
  };
  llmSettings?: {
    model?: string;
    temperature?: number;
  };
}

export interface PlanningRequest {
  goal: string;
  context?: Record<string, any>;
  constraints?: string[];
  availableActions?: string[];
}

export interface TaskPlan {
  goal: string;
  steps: TaskStep[];
  estimatedDuration?: number;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface TaskStep {
  id: string;
  action: string;
  description: string;
  parameters?: Record<string, any>;
  dependencies?: string[];
  estimatedDuration?: number;
  parallel?: boolean;
}

export class TaskPlanningCapability extends AgentCapability<TaskPlanningConfig> {
  private llmClient: any;

  protected async initializeCapability(): Promise<void> {
    this.llmClient = this.container.get('llmClient');
    this.logger.info('Task planning capability initialized');
  }

  canHandle(request: AgentCapabilityRequest): boolean {
    return request.type === 'task.planning' || 
           request.type === 'task.decompose' ||
           request.type === 'task.optimize';
  }

  async execute<PlanningRequest, TaskPlan>(
    request: AgentCapabilityRequest<PlanningRequest>
  ): Promise<AgentCapabilityResponse<TaskPlan>> {
    try {
      const { goal, context = {}, constraints = [], availableActions = [] } = request.payload as any;
      
      this.logger.debug(`Planning task: ${goal}`);
      
      const plan = await this.createTaskPlan(goal, context, constraints, availableActions);
      
      return this.createSuccessResponse(request.id, plan);
    } catch (error) {
      this.logger.error('Task planning failed:', error);
      return this.createErrorResponse(request.id, error as Error);
    }
  }

  private async createTaskPlan(
    goal: string,
    context: Record<string, any>,
    constraints: string[],
    availableActions: string[]
  ): Promise<TaskPlan> {
    const prompt = this.buildPlanningPrompt(goal, context, constraints, availableActions);
    
    const response = await this.llmClient.generate(prompt, {
      temperature: this.config.llmSettings?.temperature || 0.7,
      maxTokens: 1000
    });

    // Parse the LLM response into a structured plan
    const plan = this.parsePlanFromResponse(response.text, goal);
    
    return plan;
  }

  private buildPlanningPrompt(
    goal: string,
    context: Record<string, any>,
    constraints: string[],
    availableActions: string[]
  ): string {
    return `
Create a detailed task plan to achieve the following goal:
Goal: ${goal}

Context: ${JSON.stringify(context, null, 2)}

Constraints: ${constraints.join(', ')}

Available Actions: ${availableActions.join(', ')}

Please provide a step-by-step plan in the following JSON format:
{
  "steps": [
    {
      "id": "step_1",
      "action": "action_name",
      "description": "What this step does",
      "parameters": {},
      "dependencies": [],
      "estimatedDuration": 60,
      "parallel": false
    }
  ],
  "estimatedDuration": 300
}
`;
  }

  private parsePlanFromResponse(response: string, goal: string): TaskPlan {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in planning response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        goal,
        steps: parsed.steps || [],
        estimatedDuration: parsed.estimatedDuration,
        dependencies: parsed.dependencies || [],
        metadata: {
          createdAt: Date.now(),
          source: 'llm_planning'
        }
      };
    } catch (error) {
      this.logger.warn('Failed to parse structured plan, creating fallback');
      
      // Create a simple fallback plan
      return {
        goal,
        steps: [
          {
            id: 'step_1',
            action: 'manual_execution',
            description: `Execute: ${goal}`,
            parameters: { goal },
            dependencies: []
          }
        ],
        estimatedDuration: 300,
        metadata: {
          createdAt: Date.now(),
          source: 'fallback_planning'
        }
      };
    }
  }
}
