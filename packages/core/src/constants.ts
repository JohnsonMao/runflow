/** Default maximum flow-call nesting depth. When a flow step would run the callee at this depth, the step fails with depth-exceeded error. */
export const DEFAULT_MAX_FLOW_CALL_DEPTH = 32

/** When allowedCommands is not set, command steps only allow these executables (minimal safe default). */
export const DEFAULT_ALLOWED_COMMANDS = ['echo', 'exit', 'true', 'false']
