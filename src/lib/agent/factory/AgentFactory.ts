import { AgentOptions } from '../BaseAgent';
import { ProductivityAgent } from '../ProductivityAgent';
import { AnswerAgent } from '../AnswerAgent';
import { ValidatorAgent } from '../ValidatorAgent';
import { PlannerAgent } from '../PlannerAgent';
import { ClassificationAgent } from '../ClassificationAgent';
import { BaseAgent } from '../BaseAgent';

export abstract class AgentFactory {
  abstract createAgent(options: AgentOptions): BaseAgent;
  
  async initializeAgent(agent: BaseAgent): Promise<BaseAgent> {
    await agent.initialize();
    return agent;
  }
}

export class ProductivityAgentFactory extends AgentFactory {
  createAgent(options: AgentOptions): ProductivityAgent {
    return new ProductivityAgent(options);
  }
}

export class AnswerAgentFactory extends AgentFactory {
  createAgent(options: AgentOptions): AnswerAgent {
    return new AnswerAgent(options);
  }
}

export class ValidatorAgentFactory extends AgentFactory {
  createAgent(options: AgentOptions): ValidatorAgent {
    return new ValidatorAgent(options);
  }
}

export class PlannerAgentFactory extends AgentFactory {
  createAgent(options: AgentOptions): PlannerAgent {
    return new PlannerAgent(options);
  }
}

export class ClassificationAgentFactory extends AgentFactory {
  createAgent(options: AgentOptions): ClassificationAgent {
    return new ClassificationAgent(options);
  }
}

// Registry for factories
export class AgentFactoryRegistry {
  private static factories = new Map<string, AgentFactory>([
    ['productivity', new ProductivityAgentFactory()],
    ['answer', new AnswerAgentFactory()],
    ['validator', new ValidatorAgentFactory()],
    ['planner', new PlannerAgentFactory()],
    ['classification', new ClassificationAgentFactory()]
  ]);
  
  static async createAgent(type: string, options: AgentOptions): Promise<BaseAgent> {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown agent type: ${type}`);
    }
    
    const agent = factory.createAgent(options);
    return factory.initializeAgent(agent);
  }
}