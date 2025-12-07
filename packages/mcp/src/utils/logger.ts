interface ILogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

type LogLevelType = "debug" | "info" | "warn" | "error";

class McpLogger implements ILogger {
  private static instance: McpLogger | null = null;
  private readonly logLevel: LogLevelType;
  private readonly enableTimestamp: boolean;

  private constructor() {
    const envLogLevel = (process.env.MCP_LOG_LEVEL?.toLowerCase() || "info") as LogLevelType;
    const validLevels: LogLevelType[] = ["debug", "info", "warn", "error"];
    this.logLevel = validLevels.includes(envLogLevel) ? envLogLevel : "info";
    this.enableTimestamp = process.env.MCP_LOG_TIMESTAMP !== "false";
  }

  static getInstance(): McpLogger {
    if (McpLogger.instance === null) {
      McpLogger.instance = new McpLogger();
    }
    return McpLogger.instance;
  }

  private shouldLog(level: LogLevelType): boolean {
    const levels: LogLevelType[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevelType, message: string): string {
    const timestamp = this.enableTimestamp ? `[${new Date().toISOString()}] ` : "";
    const levelTag = `[${level.toUpperCase()}]`;
    return `${timestamp}${levelTag} ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.error(this.formatMessage("debug", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.error(this.formatMessage("info", message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.error(this.formatMessage("warn", message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message), ...args);
    }
  }
}

/**
 * All logs are output to stderr because MCP Server uses stdout for JSON-RPC communication.
 */
export const logger = McpLogger.getInstance();

export type { ILogger, LogLevelType };
