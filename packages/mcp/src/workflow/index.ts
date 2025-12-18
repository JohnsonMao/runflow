import {
  convertJsonSchemaToZod,
  createFlowLoader,
  createNodeRegistry,
  type Flow,
  FlowExecutor,
  McpToolNodeExecutor,
  type TriggerMcpTool,
} from "@bricks/flow";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpClientManager } from "../client";
import { logger } from "../utils";

export interface IWorkflowOptions {
  flowsPath?: string;
  clientManager: McpClientManager;
  serverName?: string;
}

interface RegisteredFlow {
  flow: Flow;
  toolName: string;
  title: string;
  description: string;
  inputSchema?: unknown;
}

class FlowRegistry {
  private flows: Map<string, RegisteredFlow> = new Map();

  register(
    flow: Flow,
    toolName: string,
    title: string,
    description: string,
    inputSchema?: unknown
  ): void {
    this.flows.set(toolName, {
      flow,
      toolName,
      title,
      description,
      inputSchema,
    });
  }

  getAll(): RegisteredFlow[] {
    return Array.from(this.flows.values());
  }

  getByToolName(toolName: string): RegisteredFlow | undefined {
    return this.flows.get(toolName);
  }

  getByFlowId(flowId: string): RegisteredFlow | undefined {
    const toolName = `flow:${flowId}`;
    return this.flows.get(toolName);
  }
}

let flowRegistry: FlowRegistry | null = null;

export function getFlowRegistry(): FlowRegistry {
  if (!flowRegistry) {
    flowRegistry = new FlowRegistry();
  }
  return flowRegistry;
}

export function getRegisteredFlows(): RegisteredFlow[] {
  return getFlowRegistry().getAll();
}

export function getRegisteredFlowById(flowId: string): RegisteredFlow | undefined {
  return getFlowRegistry().getByFlowId(flowId);
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

export function registerWorkflows(server: McpServer, options: IWorkflowOptions): void {
  const { flowsPath, clientManager } = options;

  if (!flowsPath) {
    return;
  }

  const registry = getFlowRegistry();

  try {
    const loader = createFlowLoader(flowsPath, {
      recursive: false,
      extensions: [".yaml", ".yml"],
    });

    loader
      .loadAll()
      .then((flows) => {
        const mcpToolFlows = flows.filter(
          (flow) => flow.active && flow.triggers?.some((trigger) => trigger.type === "mcpTool")
        );

        logger.info(`Found ${mcpToolFlows.length} flow(s) with MCP Tool triggers`);

        for (const flow of mcpToolFlows) {
          const trigger = flow.triggers?.find((t) => t.type === "mcpTool");
          if (!trigger || !isMcpToolTrigger(trigger)) {
            continue;
          }

          const toolName = `flow:${flow.id}`;
          const title = trigger.parameters.title || flow.name;
          const description = trigger.parameters.description || flow.description || "";
          const jsonSchema = trigger.parameters.inputSchema;
          const inputSchema = jsonSchema ? convertJsonSchemaToZod(jsonSchema) : undefined;

          registry.register(flow, toolName, title, description, jsonSchema);

          server.registerTool(
            toolName,
            {
              title,
              description,
              inputSchema,
            },
            async (args: unknown) => {
              const inputArgs =
                args && typeof args === "object" ? (args as Record<string, unknown>) : {};
              return await executeFlow(flow, inputArgs, clientManager);
            }
          );

          logger.info(`Registered flow "${flow.name}" as tool "${toolName}"`);
        }
      })
      .catch((error) => {
        logger.error("Failed to load flows:", error);
      });
  } catch (error) {
    logger.error("Failed to initialize flow loader:", error);
  }
}

async function executeFlow(
  flow: Flow,
  inputArgs: Record<string, unknown>,
  clientManager: McpClientManager
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    logger.info(`Executing flow "${flow.name}" (${flow.id})`);

    const nodeRegistry = createNodeRegistry();
    nodeRegistry.register(
      "mcpTool",
      new McpToolNodeExecutor({
        callTool: async (server: string, tool: string, args: Record<string, unknown>) => {
          const connection = clientManager.getConnection(server);
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
