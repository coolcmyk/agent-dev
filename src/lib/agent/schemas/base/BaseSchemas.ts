import { z } from 'zod';

/**
 * Input schema for agent execution
 */
export const AgentInputSchema = z.object({
  instruction: z.string(), // The task instruction
  // Additional context you can pass -- different agents pass different additional context -- like BrowserAgent passes browserState, ProductivityAgent passes selectedTabIds, etc.
  context: z.record(z.unknown()).optional(),
  browserState: z.record(z.unknown()).optional(), // Current browser state
});

/**
 * Base output schema that all agents must conform to
 */
export const AgentOutputSchema = z.object({
  success: z.boolean(), // Whether the execution completed successfully
  result: z.unknown(), // Agent-specific result data
  error: z.string().optional(), // Error message if failed
  metadata: z.record(z.unknown()).optional(), // Additional metadata
});

/**
 * Base configuration options for agents
 */
export const AgentOptionsSchema = z.object({
  executionContext: z.instanceof(ExecutionContext), // Execution context instance
  systemPrompt: z.string().optional(), // Optional custom system prompt
  maxIterations: z.number().int().positive().default(10), // Maximum iterations for ReAct agents
  useVision: z.boolean().default(false), // Whether to enable vision
  debugMode: z.boolean().default(false), // Debug logging
});