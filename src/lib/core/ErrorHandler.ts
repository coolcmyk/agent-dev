import { BaseComponent, IErrorHandler, IErrorReporter } from './interfaces';

/**
 * Centralized error handling system
 * Provides error classification, handling, and reporting
 */
export class ErrorHandler extends BaseComponent {
  private errorHandlers = new Map<string, IErrorHandler[]>();
  private errorReporters: IErrorReporter[] = [];
  private errorCounts = new Map<string, number>();
  private lastErrors = new Map<string, { error: Error; context: any; timestamp: number }>();
  
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    this.log('Initializing ErrorHandler');
    this.setupDefaultHandlers();
    this._isInitialized = true;
  }
  
  async cleanup(): Promise<void> {
    this.errorHandlers.clear();
    this.errorReporters = [];
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.log('ErrorHandler cleaned up');
  }
  
  /**
   * Handle an error using registered handlers
   */
  handleError(error: Error, context?: any): void {
    const errorType = error.constructor.name;
    const errorKey = `${errorType}:${error.message}`;
    
    // Update error statistics
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    this.lastErrors.set(errorKey, { error, context, timestamp: Date.now() });
    
    this.log(`Handling error: ${errorType}`, 'error', { message: error.message, context });
    
    // Try specific handlers first
    const handlers = this.errorHandlers.get(errorType) || [];
    let handled = false;
    
    for (const handler of handlers) {
      if (handler.canHandle(error, context)) {
        try {
          handler.handle(error, context);
          handled = true;
          this.log(`Error handled by: ${handler.constructor.name}`);
          break;
        } catch (handlerError) {
          this.log(`Error in handler ${handler.constructor.name}:`, 'error', handlerError);
        }
      }
    }
    
    // Try generic handlers if no specific handler found
    if (!handled) {
      const genericHandlers = this.errorHandlers.get('*') || [];
      for (const handler of genericHandlers) {
        if (handler.canHandle(error, context)) {
          try {
            handler.handle(error, context);
            handled = true;
            this.log(`Error handled by generic handler: ${handler.constructor.name}`);
            break;
          } catch (handlerError) {
            this.log(`Error in generic handler ${handler.constructor.name}:`, 'error', handlerError);
          }
        }
      }
    }
    
    if (!handled) {
      this.log(`No handler found for error: ${errorType}`, 'warning');
    }
    
    // Report to all reporters
    this.reportError(error, context);
  }
  
  /**
   * Register an error handler for specific error types
   */
  registerHandler(errorType: string, handler: IErrorHandler): void {
    const existing = this.errorHandlers.get(errorType) || [];
    this.errorHandlers.set(errorType, [...existing, handler]);
    this.log(`Registered handler for: ${errorType}`);
  }
  
  /**
   * Register a generic error handler (handles all errors)
   */
  registerGenericHandler(handler: IErrorHandler): void {
    this.registerHandler('*', handler);
  }
  
  /**
   * Add an error reporter
   */
  addReporter(reporter: IErrorReporter): void {
    this.errorReporters.push(reporter);
    this.log(`Added error reporter: ${reporter.constructor.name}`);
  }
  
  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{ error: string; count: number; lastSeen: number }>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorsByType: Record<string, number> = {};
    const recentErrors: Array<{ error: string; count: number; lastSeen: number }> = [];
    
    for (const [errorKey, count] of this.errorCounts) {
      const [type] = errorKey.split(':');
      errorsByType[type] = (errorsByType[type] || 0) + count;
      
      const lastError = this.lastErrors.get(errorKey);
      if (lastError) {
        recentErrors.push({
          error: errorKey,
          count,
          lastSeen: lastError.timestamp
        });
      }
    }
    
    // Sort by most recent
    recentErrors.sort((a, b) => b.lastSeen - a.lastSeen);
    
    return {
      totalErrors,
      errorsByType,
      recentErrors: recentErrors.slice(0, 10) // Top 10 recent errors
    };
  }
  
  /**
   * Clear error statistics
   */
  clearStats(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.log('Error statistics cleared');
  }
  
  private reportError(error: Error, context?: any): void {
    for (const reporter of this.errorReporters) {
      try {
        reporter.report(error, context);
      } catch (reporterError) {
        console.error('Error in error reporter:', reporterError);
      }
    }
  }
  
  private setupDefaultHandlers(): void {
    // Default handler for authentication errors
    this.registerHandler('ChatModelAuthError', {
      canHandle: () => true,
      handle: (error, context) => {
        this.log('Authentication error detected - check API credentials', 'error', { error: error.message, context });
      }
    });
    
    // Default handler for forbidden errors
    this.registerHandler('ChatModelForbiddenError', {
      canHandle: () => true,
      handle: (error, context) => {
        this.log('Forbidden error detected - check API permissions', 'error', { error: error.message, context });
      }
    });
    
    // Default handler for abort errors
    this.registerHandler('AbortError', {
      canHandle: () => true,
      handle: (error, context) => {
        this.log('Operation was cancelled', 'info', { error: error.message, context });
      }
    });
    
    // Generic fallback handler
    this.registerGenericHandler({
      canHandle: () => true,
      handle: (error, context) => {
        console.error('Unhandled error:', error, 'Context:', context);
      }
    });
  }
}

/**
 * Console error reporter
 */
export class ConsoleErrorReporter implements IErrorReporter {
  report(error: Error, context?: any): void {
    console.group(`🚨 Error Report: ${error.constructor.name}`);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    if (context) {
      console.error('Context:', context);
    }
    console.groupEnd();
  }
}

/**
 * Event bus error reporter
 */
export class EventBusErrorReporter implements IErrorReporter {
  constructor(private eventBus: any) {}
  
  report(error: Error, context?: any): void {
    if (this.eventBus && typeof this.eventBus.emitSystemError === 'function') {
      this.eventBus.emitSystemError(error.message, error, context?.source || 'ErrorHandler');
    }
  }
}
