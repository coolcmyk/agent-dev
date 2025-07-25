import { z } from 'zod'

/**
 * Message types for extension communication
 */
export enum MessageType {
  NAVIGATE = 'NAVIGATE',
  CLICK = 'CLICK',
  EXTRACT = 'EXTRACT',
  LOG = 'LOG',
  CONTENT_READY = 'CONTENT_READY',
  EXECUTE_WORKFLOW = 'EXECUTE_WORKFLOW',
  WORKFLOW_STATUS = 'WORKFLOW_STATUS',
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  EXECUTE_QUERY = 'EXECUTE_QUERY',
  HEARTBEAT = 'HEARTBEAT',
  HEARTBEAT_ACK = 'HEARTBEAT_ACK',
  AGENT_STREAM_UPDATE = 'AGENT_STREAM_UPDATE',
  CANCEL_TASK = 'CANCEL_TASK',
  CLOSE_PANEL = 'CLOSE_PANEL',
  RESET_CONVERSATION = 'RESET_CONVERSATION',
  GET_TABS = 'GET_TABS',
  GET_TAB_HISTORY = 'GET_TAB_HISTORY',
  INTENT_PREDICTION_UPDATED = 'INTENT_PREDICTION_UPDATED',
  INTENT_BUBBLES_SHOW = 'INTENT_BUBBLES_SHOW',
  INTENT_BUBBLE_CLICKED = 'INTENT_BUBBLE_CLICKED'
}

// Create a zod enum for MessageType
const MessageTypeSchema = z.nativeEnum(MessageType)

/**
 * Base message schema
 */
export const MessageSchema = z.object({
  type: MessageTypeSchema,
  payload: z.unknown()
})

export type Message = z.infer<typeof MessageSchema>

/**
 * Navigation message schema
 */
export const NavigateMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.NAVIGATE),
  payload: z.object({
    url: z.string()
  })
})

export type NavigateMessage = z.infer<typeof NavigateMessageSchema>

/**
 * Click message schema
 */
export const ClickMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.CLICK),
  payload: z.object({
    selector: z.string()
  })
})

export type ClickMessage = z.infer<typeof ClickMessageSchema>

/**
 * Log message schema
 */
export const LogMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.LOG),
  payload: z.object({
    source: z.string(),
    message: z.string(),
    level: z.enum(['info', 'error', 'warning']),
    timestamp: z.string()
  })
})

export type LogMessage = z.infer<typeof LogMessageSchema>

/**
 * Content ready message schema
 */
export const ContentReadyMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.CONTENT_READY),
  payload: z.object({
    url: z.string(),
    title: z.string()
  })
})

export type ContentReadyMessage = z.infer<typeof ContentReadyMessageSchema>

/**
 * Execute workflow message schema
 */
export const ExecuteWorkflowMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.EXECUTE_WORKFLOW),
  payload: z.object({
    dsl: z.string()
  })
})

export type ExecuteWorkflowMessage = z.infer<typeof ExecuteWorkflowMessageSchema>

/**
 * Workflow status message schema
 */
export const WorkflowStatusMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.WORKFLOW_STATUS),
  payload: z.object({
    workflowId: z.string(),
    steps: z.array(
      z.object({
        id: z.string(),
        status: z.string(),
        message: z.string().optional(),
        error: z.string().optional()
      })
    ),
    output: z.unknown().optional()
  })
})

export type WorkflowStatusMessage = z.infer<typeof WorkflowStatusMessageSchema>

/**
 * Connection status message schema
 */
export const ConnectionStatusMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.CONNECTION_STATUS),
  payload: z.object({
    connected: z.boolean(),
    port: z.string().optional()
  })
})

export type ConnectionStatusMessage = z.infer<typeof ConnectionStatusMessageSchema>

/**
 * Execute query message schema
 */
export const ExecuteQueryMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.EXECUTE_QUERY),
  payload: z.object({
    query: z.string(),
    tabIds: z.array(z.number()).optional(),  // Selected tab IDs for context
    source: z.string().optional()  // Source of the query (e.g., 'sidepanel')
  })
})

export type ExecuteQueryMessage = z.infer<typeof ExecuteQueryMessageSchema>

/**
 * Heartbeat message schema
 */
export const HeartbeatMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.HEARTBEAT),
  payload: z.object({
    timestamp: z.number()  // Timestamp when heartbeat was sent
  })
})

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>

/**
 * Heartbeat acknowledgment message schema
 */
export const HeartbeatAckMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.HEARTBEAT_ACK),
  payload: z.object({
    timestamp: z.number()  // Original timestamp from heartbeat
  })
})

export type HeartbeatAckMessage = z.infer<typeof HeartbeatAckMessageSchema>

/**
 * Agent stream update message schema
 */
export const AgentStreamUpdateMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.AGENT_STREAM_UPDATE),
  payload: z.object({
    step: z.number(),  // Current step number
    action: z.string(),  // What the agent is doing
    status: z.enum(['thinking', 'executing', 'completed', 'error', 'debug']),  // Status of the current step
    details: z.object({
      content: z.string().optional(),  // Agent's thinking or response
      toolName: z.string().optional(),  // Tool being used
      toolArgs: z.any().optional(),  // Arguments passed to the tool
      toolResult: z.string().optional(),  // Result from tool execution
      error: z.string().optional(),  // Error message if any
      messageType: z.string().optional(),  // Type of message (ToolCall, ToolResponse, etc.)
      messageId: z.string().optional(),  // ID for tracking streaming messages
      segmentId: z.number().optional(),  // Segment ID for grouping related content
      data: z.any().optional(),  // Optional data for debug messages
      timestamp: z.string().optional()  // Optional timestamp for debug messages
    })
  })
})

export type AgentStreamUpdateMessage = z.infer<typeof AgentStreamUpdateMessageSchema>

/**
 * Cancel task message schema
 */
export const CancelTaskMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.CANCEL_TASK),
  payload: z.object({
    reason: z.string().optional(),  // Optional reason for cancellation
    source: z.string().optional()  // Source that requested cancellation (e.g., 'sidepanel', 'newtab')
  })
})

export type CancelTaskMessage = z.infer<typeof CancelTaskMessageSchema>

/**
 * Close panel message schema
 */
export const ClosePanelMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.CLOSE_PANEL),
  payload: z.object({
    reason: z.string().optional()  // Optional reason for closing
  })
})

export type ClosePanelMessage = z.infer<typeof ClosePanelMessageSchema>

/**
 * Reset conversation message schema
 */
export const ResetConversationMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.RESET_CONVERSATION),
  payload: z.object({
    source: z.string().optional()  // Source that requested reset (e.g., 'sidepanel', 'options')
  })
})

export type ResetConversationMessage = z.infer<typeof ResetConversationMessageSchema>

/**
 * Get tabs message schema
 */
export const GetTabsMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.GET_TABS),
  payload: z.object({
    currentWindowOnly: z.boolean().default(true)  // Whether to get tabs from current window only
  })
})

export type GetTabsMessage = z.infer<typeof GetTabsMessageSchema>

/**
 * Get tab history message schema
 */
export const GetTabHistoryMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.GET_TAB_HISTORY),
  payload: z.object({
    tabId: z.number(),  // Tab ID to get history for
    limit: z.number().optional().default(5)  // Number of history entries to return
  })
})

export type GetTabHistoryMessage = z.infer<typeof GetTabHistoryMessageSchema>

/**
 * Intent prediction updated message schema
 */
export const IntentPredictionUpdatedMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.INTENT_PREDICTION_UPDATED),
  payload: z.object({
    tabId: z.number(),  // Tab ID the predictions are for
    url: z.string(),  // URL of the page
    intents: z.array(z.string()),  // Predicted intents
    confidence: z.number().optional(),  // Confidence score
    timestamp: z.number(),  // When prediction was made
    error: z.string().optional()  // Error message if prediction failed
  })
})

export type IntentPredictionUpdatedMessage = z.infer<typeof IntentPredictionUpdatedMessageSchema>

/**
 * Intent bubbles show message schema
 */
export const IntentBubblesShowMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.INTENT_BUBBLES_SHOW),
  payload: z.object({
    intents: z.array(z.string()),
    confidence: z.number().optional()
  })
})

export type IntentBubblesShowMessage = z.infer<typeof IntentBubblesShowMessageSchema>

/**
 * Intent bubble clicked message schema
 */
export const IntentBubbleClickedMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.INTENT_BUBBLE_CLICKED),
  payload: z.object({
    intent: z.string()
  })
})

export type IntentBubbleClickedMessage = z.infer<typeof IntentBubbleClickedMessageSchema>

/**
 * Union of all message types
 */
export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  NavigateMessageSchema,
  ClickMessageSchema,
  LogMessageSchema,
  ContentReadyMessageSchema,
  ExecuteWorkflowMessageSchema,
  WorkflowStatusMessageSchema,
  ConnectionStatusMessageSchema,
  ExecuteQueryMessageSchema,
  HeartbeatMessageSchema,
  HeartbeatAckMessageSchema,
  AgentStreamUpdateMessageSchema,
  CancelTaskMessageSchema,
  ClosePanelMessageSchema,
  ResetConversationMessageSchema,
  GetTabsMessageSchema,
  GetTabHistoryMessageSchema,
  IntentPredictionUpdatedMessageSchema,
  IntentBubblesShowMessageSchema,
  IntentBubbleClickedMessageSchema
])

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>
