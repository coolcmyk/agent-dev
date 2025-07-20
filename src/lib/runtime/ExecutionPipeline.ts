import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LangChainProviderFactory } from "@/lib/llm";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";


export class ExecutionPipeline {
  private llmCache: BaseChatModel | null = null;
  private browserStateCache: { 
    state: string; 
    timestamp: number; 
    url: string;
    hash: string;
  } | null = null;
  private readonly CACHE_TTL = 3000; // Reduce to 3 seconds for more frequent refreshes
  
  constructor(private executionContext: ExecutionContext) {}
  
  async getLLM(): Promise<BaseChatModel> {
    if (!this.llmCache) {
      this.llmCache = await LangChainProviderFactory.createLLM();
    }
    return this.llmCache;
  }
  
  async getBrowserState(forceRefresh = false): Promise<string> {
    const currentPage = await this.executionContext.browserContext.getCurrentPage();
    const currentUrl = currentPage.url();
    const currentTitle = await currentPage.title();
    
    // Get a more comprehensive hash that includes DOM changes
    // Access the underlying Playwright page for evaluate method
    const playwrightPage = currentPage.page; // or however you access the underlying page
    const bodyHeight = await playwrightPage?.evaluate(() => document.body.scrollHeight).catch(() => 0) || 0;
    const elementCount = await playwrightPage?.evaluate(() => document.querySelectorAll('*').length).catch(() => 0) || 0;
    const currentHash = `${currentUrl}_${currentTitle}_${bodyHeight}_${elementCount}`;
    const now = Date.now();
    
    // Use cache if valid and same page
    if (!forceRefresh && 
        this.browserStateCache && 
        this.browserStateCache.hash === currentHash &&
        (now - this.browserStateCache.timestamp) < this.CACHE_TTL) {
      return this.browserStateCache.state;
    }
    
    // Refresh cache
    const state = await this.executionContext.browserContext.getBrowserStateString();
    this.browserStateCache = { 
      state, 
      timestamp: now, 
      url: currentUrl,
      hash: currentHash 
    };
    return state;
  }
  
  invalidateCache(): void {
    this.browserStateCache = null;
  }
  
  cleanup(): void {
    this.llmCache = null;
    this.browserStateCache = null;
  }
}