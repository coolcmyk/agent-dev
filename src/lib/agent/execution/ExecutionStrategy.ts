import { AgentInput, BaseAgent } from "../BaseAgent";
import { RunnableConfig } from "@langchain/core/runnables";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";

export interface IExecutionStrategy {
  execute(input: AgentInput, config: RunnableConfig | undefined, agent: BaseAgent): Promise<unknown>;
}

export class ReactExecutionStrategy implements IExecutionStrategy {
  async execute(input: AgentInput, config: RunnableConfig | undefined, agent: BaseAgent): Promise<unknown> {
    // Common ReAct execution logic
    const llm = await (agent as any).getLLM();
    const tools = (agent as any).createTools();
    const reactAgent = createReactAgent({ llm, tools });
    
    return (agent as any).executeReactAgentWithStreaming(reactAgent, input.instruction, config);
  }
}

export class LLMOnlyExecutionStrategy implements IExecutionStrategy {
  async execute(input: AgentInput, config: RunnableConfig | undefined, agent: BaseAgent): Promise<unknown> {
    // For agents that don't need ReAct (like ClassificationAgent)
    const llm = await (agent as any).getLLM();
    const systemPrompt = (agent as any).generateSystemPrompt();
    
    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: input.instruction }
    ]);
    
    return response.content;
  }
}

export class CustomExecutionStrategy implements IExecutionStrategy {
  constructor(private customExecutor: (input: AgentInput, config: RunnableConfig | undefined, agent: BaseAgent) => Promise<unknown>) {}
  
  async execute(input: AgentInput, config: RunnableConfig | undefined, agent: BaseAgent): Promise<unknown> {
    return this.customExecutor(input, config, agent);
  }
}