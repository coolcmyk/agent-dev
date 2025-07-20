/**
 * Enhanced Browser Context
 * 
 * Integrates with the new component architecture and resource pooling system
 */

import { BaseComponent } from '../core/interfaces';
import { DIContainer } from '../core/DIContainer';
import { ResourcePool } from '../core/ResourcePool';
import { EventBus } from '../events/EventBus';
import { z } from 'zod';

// Enhanced configuration schema
export const EnhancedBrowserContextConfigSchema = z.object({
  maximumWaitPageLoadTime: z.number().default(5.0),
  waitBetweenActions: z.number().default(0.1),
  homePageUrl: z.string().default('https://www.google.com'),
  useVision: z.boolean().default(true),
  poolSize: z.number().default(3),
  pageTimeout: z.number().default(30000),
  resourceLimits: z.object({
    maxPages: z.number().default(10),
    maxMemoryMB: z.number().default(512),
    maxCPUPercent: z.number().default(80)
  }).optional(),
  cacheSettings: z.object({
    enablePageCache: z.boolean().default(true),
    cacheSize: z.number().default(50),
    cacheTTL: z.number().default(300000) // 5 minutes
  }).optional()
});

export type EnhancedBrowserContextConfig = z.infer<typeof EnhancedBrowserContextConfigSchema>;

// Enhanced browser state with caching and metrics
export const EnhancedBrowserStateSchema = z.object({
  tabId: z.number(),
  url: z.string(),
  title: z.string(),
  tabs: z.array(z.object({
    id: z.number(),
    url: z.string(),
    title: z.string(),
    active: z.boolean(),
    lastAccessed: z.number()
  })),
  clickableElements: z.array(z.object({
    nodeId: z.number(),
    text: z.string(),
    tag: z.string(),
    selector: z.string().optional(),
    confidence: z.number().optional()
  })),
  typeableElements: z.array(z.object({
    nodeId: z.number(),
    text: z.string(),
    tag: z.string(),
    selector: z.string().optional(),
    inputType: z.string().optional()
  })),
  clickableElementsString: z.string(),
  typeableElementsString: z.string(),
  hierarchicalStructure: z.string().nullable().optional(),
  screenshot: z.string().nullable().optional(),
  metadata: z.object({
    loadTime: z.number(),
    domNodeCount: z.number(),
    resourceCount: z.number(),
    memoryUsage: z.number().optional(),
    cacheHit: z.boolean().optional()
  })
});

export type EnhancedBrowserState = z.infer<typeof EnhancedBrowserStateSchema>;

/**
 * Page cache entry
 */
interface PageCacheEntry {
  state: EnhancedBrowserState;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Browser page resource wrapper
 */
export interface ManagedBrowserPage {
  id: string;
  page: any; // The actual browser page instance
  createdAt: number;
  lastUsed: number;
  usageCount: number;
  isActive: boolean;
  memoryUsage?: number;
}

/**
 * Enhanced Browser Context with resource management and caching
 */
export class EnhancedBrowserContext extends BaseComponent {
  private config: EnhancedBrowserContextConfig;
  private container: DIContainer;
  private resourcePool: ResourcePool;
  private eventBus: EventBus;
  
  // Page management
  private pageCache = new Map<string, PageCacheEntry>();
  private managedPages = new Map<string, ManagedBrowserPage>();
  private currentPageId?: string;
  
  // State management
  private stateCache = new Map<string, { state: EnhancedBrowserState; timestamp: number }>();
  private userSelectedTabIds: number[] | null = null;
  private executionLockedTabId: number | null = null;

  constructor(
    config: EnhancedBrowserContextConfig,
    container: DIContainer
  ) {
    super('browser.context', container.get('logger'));
    this.config = config;
    this.container = container;
    this.resourcePool = container.get('resourcePool');
    this.eventBus = container.get('eventBus');
  }

  /**
   * Get or create a browser page
   */
  async getPage(pageId?: string): Promise<ManagedBrowserPage> {
    if (pageId && this.managedPages.has(pageId)) {
      const page = this.managedPages.get(pageId)!;
      page.lastUsed = Date.now();
      page.usageCount++;
      return page;
    }

    // Create new page
    const rawPage = await this.resourcePool.acquire('browserPage');
    const managedPage: ManagedBrowserPage = {
      id: pageId || `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      page: rawPage,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
      isActive: true
    };

    this.managedPages.set(managedPage.id, managedPage);
    this.currentPageId = managedPage.id;

    this.eventBus.emit('browser.page.created', {
      pageId: managedPage.id,
      timestamp: Date.now()
    });

    return managedPage;
  }

  /**
   * Get current page
   */
  async getCurrentPage(): Promise<ManagedBrowserPage> {
    if (this.currentPageId && this.managedPages.has(this.currentPageId)) {
      return this.managedPages.get(this.currentPageId)!;
    }

    return await this.getPage();
  }

  /**
   * Navigate to URL with caching and resource management
   */
  async navigateToUrl(url: string, options: {
    useCache?: boolean;
    timeout?: number;
    waitForLoad?: boolean;
  } = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      const page = await this.getCurrentPage();
      
      // Check cache if enabled
      if (options.useCache && this.config.cacheSettings?.enablePageCache) {
        const cached = this.getCachedState(url);
        if (cached) {
          this.logger.debug(`Using cached state for: ${url}`);
          this.eventBus.emit('browser.navigation.cache.hit', { url, pageId: page.id });
          return;
        }
      }

      this.logger.info(`Navigating to: ${url}`);
      
      // Perform navigation
      await page.page.goto(url, {
        timeout: options.timeout || this.config.pageTimeout,
        waitUntil: options.waitForLoad ? 'networkidle0' : 'domcontentloaded'
      });

      // Update page metadata
      page.lastUsed = Date.now();
      page.usageCount++;

      // Cache the result if enabled
      if (this.config.cacheSettings?.enablePageCache) {
        await this.cacheCurrentState(url);
      }

      const duration = Date.now() - startTime;
      this.eventBus.emit('browser.navigation.completed', {
        url,
        pageId: page.id,
        duration,
        fromCache: false
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Navigation failed for ${url}:`, error);
      
      this.eventBus.emit('browser.navigation.failed', {
        url,
        error: error as Error,
        duration
      });
      
      throw error;
    }
  }

  /**
   * Get enhanced browser state with caching
   */
  async getBrowserState(forceRefresh = false): Promise<EnhancedBrowserState> {
    const page = await this.getCurrentPage();
    const url = await page.page.url();
    const cacheKey = `${page.id}_${url}`;
    
    // Check cache first
    if (!forceRefresh && this.stateCache.has(cacheKey)) {
      const cached = this.stateCache.get(cacheKey)!;
      const isValid = (Date.now() - cached.timestamp) < (this.config.cacheSettings?.cacheTTL || 300000);
      
      if (isValid) {
        this.logger.debug('Using cached browser state');
        return cached.state;
      }
    }

    // Generate fresh state
    const startTime = Date.now();
    const state = await this.generateBrowserState(page);
    const loadTime = Date.now() - startTime;

    // Add metadata
    state.metadata = {
      ...state.metadata,
      loadTime,
      cacheHit: false
    };

    // Cache the state
    this.stateCache.set(cacheKey, {
      state,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    this.cleanupStateCache();

    return state;
  }

  /**
   * Generate browser state from current page
   */
  private async generateBrowserState(page: ManagedBrowserPage): Promise<EnhancedBrowserState> {
    try {
      const [url, title, tabs, clickableElements, typeableElements] = await Promise.all([
        page.page.url(),
        page.page.title(),
        this.getAllTabs(),
        this.getClickableElements(page),
        this.getTypeableElements(page)
      ]);

      // Generate formatted strings
      const clickableElementsString = this.formatElementsString(clickableElements);
      const typeableElementsString = this.formatElementsString(typeableElements);

      // Get hierarchical structure if available
      const hierarchicalStructure = await this.getHierarchicalStructure(page);

      // Take screenshot if vision is enabled
      let screenshot: string | null = null;
      if (this.config.useVision) {
        try {
          screenshot = await this.takeScreenshot(page);
        } catch (error) {
          this.logger.warn('Failed to take screenshot:', error);
        }
      }

      // Get resource metrics
      const metrics = await this.getPageMetrics(page);

      return {
        tabId: await this.getCurrentTabId(page),
        url,
        title,
        tabs,
        clickableElements,
        typeableElements,
        clickableElementsString,
        typeableElementsString,
        hierarchicalStructure,
        screenshot,
        metadata: {
          loadTime: 0, // Will be set by caller
          domNodeCount: metrics.domNodeCount,
          resourceCount: metrics.resourceCount,
          memoryUsage: metrics.memoryUsage
        }
      };
    } catch (error) {
      this.logger.error('Failed to generate browser state:', error);
      throw error;
    }
  }

  /**
   * Click element with enhanced error handling and retries
   */
  async clickElement(
    identifier: number | string,
    options: {
      retries?: number;
      waitAfter?: number;
      doubleClick?: boolean;
    } = {}
  ): Promise<void> {
    const page = await this.getCurrentPage();
    const retries = options.retries || 3;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(`Clicking element (attempt ${attempt}/${retries}): ${identifier}`);
        
        if (typeof identifier === 'number') {
          // Click by node ID
          await page.page.evaluate((nodeId: number, doubleClick: boolean) => {
            // Implementation would depend on the browser API
            const element = document.querySelector(`[data-node-id="${nodeId}"]`);
            if (element) {
              if (doubleClick) {
                (element as HTMLElement).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              } else {
                (element as HTMLElement).click();
              }
            } else {
              throw new Error(`Element with node ID ${nodeId} not found`);
            }
          }, identifier, options.doubleClick || false);
        } else {
          // Click by selector
          if (options.doubleClick) {
            await page.page.dblclick(identifier);
          } else {
            await page.page.click(identifier);
          }
        }

        // Wait after click if specified
        if (options.waitAfter) {
          await this.wait(options.waitAfter);
        }

        this.eventBus.emit('browser.element.clicked', {
          identifier,
          pageId: page.id,
          attempt,
          success: true
        });

        return; // Success
        
      } catch (error) {
        this.logger.warn(`Click attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          this.eventBus.emit('browser.element.click.failed', {
            identifier,
            pageId: page.id,
            attempts: retries,
            error: error as Error
          });
          throw error;
        }
        
        // Wait before retry
        await this.wait(1000 * attempt);
      }
    }
  }

  /**
   * Type text with enhanced handling
   */
  async typeText(
    identifier: number | string,
    text: string,
    options: {
      clear?: boolean;
      delay?: number;
      retries?: number;
    } = {}
  ): Promise<void> {
    const page = await this.getCurrentPage();
    const retries = options.retries || 3;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(`Typing text (attempt ${attempt}/${retries}): ${identifier}`);
        
        if (typeof identifier === 'number') {
          // Type by node ID
          await page.page.evaluate((nodeId: number, text: string, clear: boolean) => {
            const element = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLInputElement;
            if (element) {
              if (clear) {
                element.value = '';
              }
              element.value += text;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              throw new Error(`Element with node ID ${nodeId} not found`);
            }
          }, identifier, text, options.clear || false);
        } else {
          // Type by selector
          if (options.clear) {
            await page.page.fill(identifier, '');
          }
          await page.page.type(identifier, text, { delay: options.delay || 100 });
        }

        this.eventBus.emit('browser.text.typed', {
          identifier,
          text: text.length > 50 ? text.substring(0, 50) + '...' : text,
          pageId: page.id,
          attempt,
          success: true
        });

        return; // Success
        
      } catch (error) {
        this.logger.warn(`Type attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          this.eventBus.emit('browser.text.type.failed', {
            identifier,
            pageId: page.id,
            attempts: retries,
            error: error as Error
          });
          throw error;
        }
        
        await this.wait(1000 * attempt);
      }
    }
  }

  /**
   * Wait for specified time
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Release a page back to the resource pool
   */
  async releasePage(pageId: string): Promise<void> {
    const managedPage = this.managedPages.get(pageId);
    if (managedPage) {
      await this.resourcePool.release('browserPage', managedPage.page);
      this.managedPages.delete(pageId);
      
      if (this.currentPageId === pageId) {
        this.currentPageId = undefined;
      }

      this.eventBus.emit('browser.page.released', {
        pageId,
        usageCount: managedPage.usageCount,
        duration: Date.now() - managedPage.createdAt
      });
    }
  }

  /**
   * Set user selected tab IDs
   */
  setUserSelectedTabIds(tabIds: number[]): void {
    this.userSelectedTabIds = tabIds;
    this.eventBus.emit('browser.tabs.selected', { tabIds });
  }

  /**
   * Get user selected tab IDs
   */
  getUserSelectedTabIds(): number[] | null {
    return this.userSelectedTabIds;
  }

  /**
   * Set execution locked tab ID
   */
  setExecutionLockedTabId(tabId: number | null): void {
    this.executionLockedTabId = tabId;
    this.eventBus.emit('browser.tab.locked', { tabId });
  }

  /**
   * Get execution locked tab ID
   */
  getExecutionLockedTabId(): number | null {
    return this.executionLockedTabId;
  }

  // Private helper methods
  private getCachedState(url: string): EnhancedBrowserState | null {
    const cacheEntry = this.pageCache.get(url);
    if (cacheEntry) {
      const isValid = (Date.now() - cacheEntry.timestamp) < (this.config.cacheSettings?.cacheTTL || 300000);
      if (isValid) {
        cacheEntry.accessCount++;
        cacheEntry.lastAccessed = Date.now();
        return cacheEntry.state;
      }
    }
    return null;
  }

  private async cacheCurrentState(url: string): Promise<void> {
    if (!this.config.cacheSettings?.enablePageCache) return;
    
    try {
      const state = await this.getBrowserState(true);
      this.pageCache.set(url, {
        state,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      });

      // Cleanup if cache is too large
      const maxSize = this.config.cacheSettings.cacheSize || 50;
      if (this.pageCache.size > maxSize) {
        this.cleanupPageCache();
      }
    } catch (error) {
      this.logger.warn('Failed to cache page state:', error);
    }
  }

  private cleanupPageCache(): void {
    const entries = Array.from(this.pageCache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const toRemove = Math.ceil(entries.length * 0.3); // Remove oldest 30%
    for (let i = 0; i < toRemove; i++) {
      this.pageCache.delete(entries[i][0]);
    }
  }

  private cleanupStateCache(): void {
    const maxAge = this.config.cacheSettings?.cacheTTL || 300000;
    const cutoff = Date.now() - maxAge;
    
    for (const [key, entry] of this.stateCache.entries()) {
      if (entry.timestamp < cutoff) {
        this.stateCache.delete(key);
      }
    }
  }

  // Placeholder methods that would be implemented based on the browser API
  private async getAllTabs(): Promise<any[]> { return []; }
  private async getClickableElements(page: ManagedBrowserPage): Promise<any[]> { return []; }
  private async getTypeableElements(page: ManagedBrowserPage): Promise<any[]> { return []; }
  private async getHierarchicalStructure(page: ManagedBrowserPage): Promise<string | null> { return null; }
  private async takeScreenshot(page: ManagedBrowserPage): Promise<string | null> { return null; }
  private async getCurrentTabId(page: ManagedBrowserPage): Promise<number> { return 1; }
  private async getPageMetrics(page: ManagedBrowserPage): Promise<any> { 
    return { domNodeCount: 0, resourceCount: 0, memoryUsage: 0 }; 
  }
  private formatElementsString(elements: any[]): string { return ''; }

  protected async doInitialize(): Promise<void> {
    this.logger.info('Initializing enhanced browser context');
    
    // Setup browser page resource pool
    this.resourcePool.createPool('browserPage', {
      create: async () => {
        // Create browser page implementation
        return {}; // Placeholder
      },
      destroy: async (page) => {
        // Cleanup browser page
      },
      validate: async (page) => {
        // Validate page is still usable
        return true;
      }
    }, {
      min: 1,
      max: this.config.poolSize,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000
    });
  }

  protected async doCleanup(): Promise<void> {
    this.logger.info('Cleaning up enhanced browser context');
    
    // Release all managed pages
    for (const [pageId, _] of this.managedPages) {
      await this.releasePage(pageId);
    }
    
    // Clear caches
    this.pageCache.clear();
    this.stateCache.clear();
  }
}
