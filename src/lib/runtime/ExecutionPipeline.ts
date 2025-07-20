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
  private readonly CACHE_TTL = 3000; // 3 seconds for frequent refreshes

  constructor(private executionContext: ExecutionContext) {}

  async getLLM(): Promise<BaseChatModel> {
    if (!this.llmCache) {
      this.llmCache = await LangChainProviderFactory.createLLM();
    }
    return this.llmCache;
  }

  async getBrowserState(forceRefresh = false): Promise<string> {
    const currentPage = await this.executionContext.browserContext.getCurrentPage();
    const currentUrl = await currentPage.url();
    const currentTitle = await currentPage.title();

    // Get a more comprehensive hash that includes page state changes
    // Since we can't access DOM directly, use available page information
    const clickableElements = await currentPage.getClickableElements();
    const typeableElements = await currentPage.getTypeableElements();
    
    // Create hash based on available page data
    const elementCount = clickableElements.length + typeableElements.length;
    const elementsHash = clickableElements.map(el => `${el.nodeId}_${el.text}`).join('|');
    const currentHash = `${currentUrl}_${currentTitle}_${elementCount}_${elementsHash}`;
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