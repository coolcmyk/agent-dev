import { BaseComponent } from './interfaces';

/**
 * Resource pool for managing expensive resources like LLM instances
 * Provides thread-safe resource acquisition and release
 */
export class ResourcePool<T> extends BaseComponent {
  private available: T[] = [];
  private inUse = new Set<T>();
  private waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }> = [];
  
  private maxSize: number;
  private factory: () => Promise<T>;
  private destroyer: (resource: T) => Promise<void>;
  private validator?: (resource: T) => Promise<boolean>;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(
    maxSize: number,
    factory: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    validator?: (resource: T) => Promise<boolean>
  ) {
    super();
    this.maxSize = maxSize;
    this.factory = factory;
    this.destroyer = destroyer;
    this.validator = validator;
  }
  
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    this.log(`Initializing ResourcePool with max size: ${this.maxSize}`);
    
    // Start periodic cleanup of invalid resources
    this.cleanupInterval = setInterval(() => {
      this.cleanupInvalidResources();
    }, 30000); // Every 30 seconds
    
    this._isInitialized = true;
  }
  
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      if (waiting.timeout) {
        clearTimeout(waiting.timeout);
      }
      waiting.reject(new Error('ResourcePool is being cleaned up'));
    }
    
    // Destroy all resources
    const allResources = [...this.available, ...this.inUse];
    this.available = [];
    this.inUse.clear();
    
    await Promise.all(allResources.map(resource => 
      this.destroyer(resource).catch(error => 
        this.log('Error destroying resource during cleanup:', 'error', error)
      )
    ));
    
    this.log('ResourcePool cleaned up');
  }
  
  /**
   * Acquire a resource from the pool
   */
  async acquire(timeoutMs = 30000): Promise<T> {
    await this.ensureInitialized();
    
    // Return available resource if any
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      
      // Validate resource if validator is provided
      if (this.validator) {
        const isValid = await this.validator(resource).catch(() => false);
        if (!isValid) {
          // Resource is invalid, destroy it and try again
          await this.destroyer(resource).catch(error => 
            this.log('Error destroying invalid resource:', 'error', error)
          );
          return this.acquire(timeoutMs);
        }
      }
      
      this.inUse.add(resource);
      this.log('Acquired available resource from pool');
      return resource;
    }
    
    // Create new resource if under limit
    if (this.inUse.size < this.maxSize) {
      try {
        const resource = await this.factory();
        this.inUse.add(resource);
        this.log('Created new resource');
        return resource;
      } catch (error) {
        this.log('Failed to create new resource:', 'error', error);
        throw error;
      }
    }
    
    // Wait for available resource
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Resource acquisition timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      this.waitingQueue.push({ resolve, reject, timeout });
      this.log(`Queued resource request (queue size: ${this.waitingQueue.length})`);
    });
  }
  
  /**
   * Release a resource back to the pool
   */
  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      this.log('Attempted to release resource not in use', 'warning');
      return;
    }
    
    this.inUse.delete(resource);
    
    // Serve waiting request if any
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      if (waiting.timeout) {
        clearTimeout(waiting.timeout);
      }
      
      // Validate resource before giving to waiter
      if (this.validator) {
        const isValid = await this.validator(resource).catch(() => false);
        if (!isValid) {
          await this.destroyer(resource).catch(error => 
            this.log('Error destroying invalid resource:', 'error', error)
          );
          waiting.reject(new Error('Resource became invalid'));
          return;
        }
      }
      
      this.inUse.add(resource);
      waiting.resolve(resource);
      this.log('Released resource to waiting request');
      return;
    }
    
    // Return to available pool
    this.available.push(resource);
    this.log('Released resource to pool');
  }
  
  /**
   * Get pool statistics
   */
  getStats(): {
    available: number;
    inUse: number;
    waiting: number;
    maxSize: number;
    utilizationPercent: number;
  } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waitingQueue.length,
      maxSize: this.maxSize,
      utilizationPercent: Math.round((this.inUse.size / this.maxSize) * 100)
    };
  }
  
  /**
   * Force cleanup of invalid resources
   */
  private async cleanupInvalidResources(): Promise<void> {
    if (!this.validator) return;
    
    const invalidResources: T[] = [];
    
    // Check available resources
    for (const resource of this.available) {
      try {
        const isValid = await this.validator(resource);
        if (!isValid) {
          invalidResources.push(resource);
        }
      } catch (error) {
        this.log('Error validating resource:', 'error', error);
        invalidResources.push(resource);
      }
    }
    
    // Remove and destroy invalid resources
    for (const resource of invalidResources) {
      const index = this.available.indexOf(resource);
      if (index > -1) {
        this.available.splice(index, 1);
        await this.destroyer(resource).catch(error => 
          this.log('Error destroying invalid resource:', 'error', error)
        );
      }
    }
    
    if (invalidResources.length > 0) {
      this.log(`Cleaned up ${invalidResources.length} invalid resources`);
    }
  }
}

/**
 * Resource pool manager for different types of resources
 */
export class ResourcePoolManager extends BaseComponent {
  private pools = new Map<string, ResourcePool<any>>();
  
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    this.log('Initializing ResourcePoolManager');
    this._isInitialized = true;
  }
  
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.pools.values()).map(pool => pool.cleanup());
    await Promise.all(cleanupPromises);
    this.pools.clear();
    this.log('ResourcePoolManager cleaned up');
  }
  
  /**
   * Register a resource pool
   */
  registerPool<T>(name: string, pool: ResourcePool<T>): void {
    this.pools.set(name, pool);
    pool.initialize().catch(error => 
      this.log(`Failed to initialize pool ${name}:`, 'error', error)
    );
  }
  
  /**
   * Get a resource pool by name
   */
  getPool<T>(name: string): ResourcePool<T> | undefined {
    return this.pools.get(name);
  }
  
  /**
   * Get statistics for all pools
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStats();
    }
    return stats;
  }
}
