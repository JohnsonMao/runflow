import type { Flow } from "@bricks/flow";
import {
  FlowExecutor,
  FlowLoader,
  McpToolNodeExecutor,
  NodeRegistry,
  type TriggerMcpTool,
} from "@bricks/flow";
import type { McpClientManager } from "../client";
import { logger } from "../utils";

export interface IRegisteredFlow {
  flow: Flow;
  toolName: string;
  title: string;
  description: string;
  inputSchema?: unknown;
}

export interface ICreateWorkflowManagerOptions {
  flowsPath?: string;
  clientManager: McpClientManager;
  watch?: boolean;
}

function isMcpToolTrigger(trigger: unknown): trigger is TriggerMcpTool {
  return (
    typeof trigger === "object" &&
    trigger !== null &&
    "type" in trigger &&
    trigger.type === "mcpTool" &&
    "parameters" in trigger &&
    typeof trigger.parameters === "object" &&
    trigger.parameters !== null &&
    "title" in trigger.parameters &&
    "description" in trigger.parameters
  );
}

export class WorkflowManager {
  private flows: Map<string, IRegisteredFlow> = new Map();
  private clientManager: McpClientManager;
  private flowsPath?: string;
  private watcher?: ReturnType<typeof import("chokidar")["default"]["watch"]>;
  private reloadDebounceTimer?: NodeJS.Timeout;

  constructor(clientManager: McpClientManager) {
    this.clientManager = clientManager;
  }

  register(flow: IRegisteredFlow): void {
    this.flows.set(flow.toolName, flow);
  }

  getAllFlows(): IRegisteredFlow[] {
    return Array.from(this.flows.values());
  }

  getFlowByToolName(toolName: string): IRegisteredFlow | undefined {
    return this.flows.get(toolName);
  }

  getFlowById(flowId: string): IRegisteredFlow | undefined {
    return this.flows.get(flowId);
  }

  async load(options: { flowsPath?: string; watch?: boolean }): Promise<void> {
    const { flowsPath, watch = false } = options;

    if (!flowsPath) {
      return;
    }

    this.flowsPath = flowsPath;
    await this.reloadFlows();

    if (watch && !this.watcher) {
      await this.startWatching();
    }
  }

  private async reloadFlows(): Promise<void> {
    if (!this.flowsPath) {
      return;
    }

    try {
      this.flows.clear();

      const loader = new FlowLoader(this.flowsPath, {
        recursive: false,
        extensions: [".yaml", ".yml"],
      });

      const flows = await loader.loadAll();
      const mcpToolFlows = flows.filter(
        (flow) => flow.active && flow.triggers?.some((trigger) => trigger.type === "mcpTool")
      );

      logger.info(`Found ${mcpToolFlows.length} flow(s) with MCP Tool triggers`);

      for (const flow of mcpToolFlows) {
        const trigger = flow.triggers?.find((t) => t.type === "mcpTool");
        if (!trigger || !isMcpToolTrigger(trigger)) {
          continue;
        }

        const toolName = flow.id;
        const title = trigger.parameters.title || flow.name;
        const description = trigger.parameters.description || flow.description || "";
        const { inputSchema } = trigger.parameters;

        this.register({
          flow,
          toolName,
          title,
          description,
          inputSchema,
        });

        logger.info(`Loaded flow "${flow.name}" as tool "${toolName}"`);
      }
    } catch (error) {
      logger.error("Failed to reload flows:", error);
    }
  }

  private async startWatching(): Promise<void> {
    if (!this.flowsPath) {
      return;
    }

    const chokidar = await import("chokidar");
    this.watcher = chokidar.watch(this.flowsPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on("all", (event: string, path: string) => {
      if (event === "add" || event === "change" || event === "unlink") {
        const ext = path.slice(path.lastIndexOf("."));
        if (ext === ".yaml" || ext === ".yml") {
          this.handleFileChange();
        }
      }
    });

    logger.info(`Watching for flow file changes in: ${this.flowsPath}`);
  }

  private handleFileChange(): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }

    this.reloadDebounceTimer = setTimeout(async () => {
      logger.info("Flow files changed, reloading...");
      await this.reloadFlows();
      logger.info("Flows reloaded successfully");
    }, 300);
  }

  dispose(): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  async execute(
    toolName: string,
    inputArgs: Record<string, unknown>
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const registeredFlow = this.getFlowByToolName(toolName);
    if (!registeredFlow) {
      throw new Error(`Flow "${toolName}" not found`);
    }

    return this.executeFlow(registeredFlow.flow, inputArgs);
  }

  async executeFlow(
    flow: Flow,
    inputArgs: Record<string, unknown>
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
      logger.info(`Executing flow "${flow.name}" (${flow.id})`);

      const nodeRegistry = new NodeRegistry();
      nodeRegistry.register(
        "mcpTool",
        new McpToolNodeExecutor({
          callTool: async (server: string, tool: string, args: Record<string, unknown>) => {
            const connection = this.clientManager.getConnection(server);
            if (!connection) {
              throw new Error(`MCP server "${server}" not connected`);
            }

            const result = await connection.client.callTool({
              name: tool,
              arguments: args,
            });

            return result;
          },
        })
      );

      const executor = new FlowExecutor({
        nodeRegistry,
        initialInput: [{ json: inputArgs }],
        onNodeExecute: (nodeName: string, nodeType: string) => {
          logger.debug(`Executing node "${nodeName}" (${nodeType})`);
        },
      });

      const executionResult = await executor.execute(flow);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(executionResult.result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Flow execution failed: ${errorMessage}`, error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                error: errorMessage,
                flowId: flow.id,
                flowName: flow.name,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  static async create(options: ICreateWorkflowManagerOptions): Promise<WorkflowManager> {
    const manager = new WorkflowManager(options.clientManager);
    await manager.load({ flowsPath: options.flowsPath, watch: options.watch });
    return manager;
  }
}
