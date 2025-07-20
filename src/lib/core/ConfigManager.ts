import { DIContainer, TOKENS } from './DIContainer';
import { IConfigurable, BaseComponent } from './interfaces';
import { z } from 'zod';

/**
 * Configuration value with metadata
 */
interface ConfigValue<T> {
  value: T;
  schema: z.ZodSchema<T>;
  watchers: ((value: T) => void)[];
  lastModified: number;
}

/**
 * Centralized configuration management system
 * Provides type-safe configuration with validation, watching, and hot-reloading
 */
export class ConfigManager extends BaseComponent implements IConfigurable<any> {
  private configs = new Map<string, ConfigValue<any>>();
  private globalWatchers: ((key: string, value: any) => void)[] = [];
  
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    this.log('Initializing ConfigManager');
    this._isInitialized = true;
  }
  
  async cleanup(): Promise<void> {
    this.configs.clear();
    this.globalWatchers = [];
    this.log('ConfigManager cleaned up');
  }
  
  /**
   * Register a configuration with default value and validation schema
   */
  registerConfig<T>(key: string, defaultValue: T, schema: z.ZodSchema<T>): void {
    const validatedValue = schema.parse(defaultValue);
    
    this.configs.set(key, {
      value: validatedValue,
      schema,
      watchers: [],
      lastModified: Date.now()
    });
    
    this.log(`Registered config: ${key}`, 'info', { defaultValue: validatedValue });
  }
  
  /**
   * Update configuration value
   */
  updateConfig<T>(key: string, updates: Partial<T>): void {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`Configuration not found: ${key}`);
    }
    
    const newValue = { ...config.value, ...updates };
    const validatedValue = config.schema.parse(newValue);
    
    config.value = validatedValue;
    config.lastModified = Date.now();
    
    // Notify watchers
    config.watchers.forEach(watcher => {
      try {
        watcher(validatedValue);
      } catch (error) {
        this.log(`Error in config watcher for ${key}:`, 'error', error);
      }
    });
    
    // Notify global watchers
    this.globalWatchers.forEach(watcher => {
      try {
        watcher(key, validatedValue);
      } catch (error) {
        this.log(`Error in global config watcher:`, 'error', error);
      }
    });
    
    this.log(`Updated config: ${key}`, 'info', { newValue: validatedValue });
  }
  
  /**
   * Get configuration value
   */
  getConfig<T>(key: string): T {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`Configuration not found: ${key}`);
    }
    return config.value;
  }
  
  /**
   * Check if configuration exists
   */
  hasConfig(key: string): boolean {
    return this.configs.has(key);
  }
  
  /**
   * Watch for configuration changes
   */
  watchConfig<T>(key: string, callback: (value: T) => void): () => void {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`Configuration not found: ${key}`);
    }
    
    config.watchers.push(callback);
    
    // Call immediately with current value
    callback(config.value);
    
    // Return unsubscribe function
    return () => {
      const index = config.watchers.indexOf(callback);
      if (index > -1) {
        config.watchers.splice(index, 1);
      }
    };
  }
  
  /**
   * Watch all configuration changes
   */
  watchAllConfigs(callback: (key: string, value: any) => void): () => void {
    this.globalWatchers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.globalWatchers.indexOf(callback);
      if (index > -1) {
        this.globalWatchers.splice(index, 1);
      }
    };
  }
  
  /**
   * Get all configuration keys
   */
  getConfigKeys(): string[] {
    return Array.from(this.configs.keys());
  }
  
  /**
   * Get configuration metadata
   */
  getConfigInfo(key: string): { lastModified: number; hasWatchers: boolean } | null {
    const config = this.configs.get(key);
    if (!config) return null;
    
    return {
      lastModified: config.lastModified,
      hasWatchers: config.watchers.length > 0
    };
  }
  
  /**
   * Bulk update multiple configurations
   */
  updateConfigs(updates: Record<string, any>): void {
    for (const [key, value] of Object.entries(updates)) {
      if (this.hasConfig(key)) {
        this.updateConfig(key, value);
      } else {
        this.log(`Skipping unknown config: ${key}`, 'warning');
      }
    }
  }
  
  /**
   * Export all configurations (useful for debugging)
   */
  exportConfigs(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, config] of this.configs) {
      result[key] = config.value;
    }
    return result;
  }
}

/**
 * Default configuration keys for the application
 */
export const CONFIG_KEYS = {
  BROWSER_CONTEXT: 'browserContext',
  EXECUTION_PIPELINE: 'executionPipeline',
  AGENT_DEFAULTS: 'agentDefaults',
  TOOL_REGISTRY: 'toolRegistry',
  ERROR_HANDLING: 'errorHandling',
  PERFORMANCE: 'performance',
  DEBUGGING: 'debugging',
} as const;
