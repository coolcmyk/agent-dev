import { BaseAgent, AgentOptions } from "../BaseAgent";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LangChainProviderFactory } from "@/lib/llm";
import { AgentFactoryRegistry } from "../factory/AgentFactory";

export class AgentCache {
  private static instances = new Map<string, BaseAgent>();
  private static llmCache = new Map<string, BaseChatModel>();
  
  static async getOrCreateAgent(type: string, options: AgentOptions): Promise<BaseAgent> {
    const key = `${type}-${JSON.stringify(options)}`;
    
    if (!this.instances.has(key)) {
      const agent = await AgentFactoryRegistry.createAgent(type, options);
      this.instances.set(key, agent);
    }
    
    return this.instances.get(key)!;
  }
  
  static async getCachedLLM(settings: any): Promise<BaseChatModel> {
    const key = JSON.stringify(settings);
    
    if (!this.llmCache.has(key)) {
      const llm = await LangChainProviderFactory.createLLM();
      this.llmCache.set(key, llm);
    }
    
    return this.llmCache.get(key)!;
  }
}