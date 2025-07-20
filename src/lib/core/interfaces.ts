/**
 * Core interfaces for component lifecycle management and shared behaviors
 */

export interface IInitializable {
  initialize(): Promise<void>;
  isInitialized(): boolean;
}

export interface ICleanable {
  cleanup(): Promise<void>;
}

export interface ICacheable {
  invalidateCache(): void;
  clearCache(): void;
}

export interface IConfigurable<T> {
  updateConfig(config: Partial<T>): void;
  getConfig(): T;
}

export interface ILoggable {
  log(message: string, level?: 'info' | 'warning' | 'error', data?: any): void;
}

export interface IResourcePoolable {
  acquire<T>(token: string | symbol): Promise<T>;
  release<T>(token: string | symbol, resource: T): Promise<void>;
}

/**
 * Base component that all major classes should extend
 * Provides common lifecycle management and dependency injection support
 */
export abstract class BaseComponent implements IInitializable, ICleanable, ILoggable {
  protected _isInitialized = false;
  protected debugMode = false;
  
  abstract initialize(): Promise<void>;
  abstract cleanup(): Promise<void>;
  
  isInitialized(): boolean {
    return this._isInitialized;
  }
  
  protected setInitialized(value: boolean): void {
    this._isInitialized = value;
  }
  
  protected setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  log(message: string, level: 'info' | 'warning' | 'error' = 'info', data?: any): void {
    if (this.debugMode || level === 'error') {
      console[level](`[${this.constructor.name}] ${message}`, data || '');
    }
  }
  
  protected async ensureInitialized(): Promise<void> {
    if (!this._isInitialized) {
      await this.initialize();
    }
  }
}

/**
 * Plugin interface for extensible systems
 */
export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  
  install(target: any): Promise<void>;
  uninstall(target: any): Promise<void>;
}

/**
 * Event handler interface for event-driven architecture
 */
export interface IEventHandler<T = any> {
  handle(event: T): Promise<void> | void;
  canHandle(event: any): boolean;
}

/**
 * Error handler interface for centralized error management
 */
export interface IErrorHandler {
  canHandle(error: Error, context?: any): boolean;
  handle(error: Error, context?: any): void;
}

/**
 * Error reporter interface for error reporting systems
 */
export interface IErrorReporter {
  report(error: Error, context?: any): void;
}

/**
 * Event middleware interface for event processing pipelines
 */
export interface IEventMiddleware {
  process<T>(eventType: string, event: T): Promise<T>;
}
