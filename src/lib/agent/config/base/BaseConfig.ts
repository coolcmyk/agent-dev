export const BASE_AGENT = {
  MAX_ITERATIONS: 10,
  STREAMING_VERSION: "v2",
  LANGCHAIN_NAMESPACE: ["nxtscape", "agents"],
  RECURSION_LIMIT_DEFAULT: 25,
  
  ABORT_ERROR_PATTERNS: [
    "AbortError",
    "Aborted", 
    "cancelled",
    "stopped"
  ],
  
  LOG_PREFIXES: {
    STARTING: "🚀🚀 Starting",
    COMPLETED: "✅✅",
    FAILED: "❌",
    INITIALIZING: "🚀 Initializing"
  },
  
  TOOL_SETUP_MESSAGE: "🔧 Setting up",
  
  KNOWN_LANGRAPH_ERROR: "ToolNode only accepts AIMessages as input"
}



export const BASE_AGENT_STREAMING = {
  VERSION: "v2" as const,
  CHECK_CANCELLATION: true,
  EMIT_THINKING_ON_START: true,
  COMPLETE_ON_FINISH: true
}