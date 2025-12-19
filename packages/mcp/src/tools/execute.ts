import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import type { McpClientManager } from "../client";
import { logger } from "../utils";
import type { WorkflowManager } from "../workflow";

interface ExecuteArgs {
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

const formatToolResult = (
  result: CallToolResult | undefined,
  toolName: string,
  serverName: string
): CallToolResult => {
  if (!result) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool "${toolName}" on server "${serverName}":\n\nTool returned undefined result.`,
        },
      ],
      isError: true,
    };
  }

  if ((result as { isError?: boolean }).isError) {
    const errorText =
      result.content
        ?.map((item) => (item.type === "text" ? item.text : ""))
        .filter(Boolean)
        .join("\n") || "Unknown error";

    return {
      content: [
        {
          type: "text",
          text: `Error executing tool "${toolName}" on server "${serverName}":\n\n${errorText}`,
        },
      ],
      isError: true,
    };
  }

  if (!result.content || result.content.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `Tool "${toolName}" executed successfully, but returned no content.`,
        },
      ],
    };
  }

  return result;
};

interface ExecuteToolOptions {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
}

const executeToolFromConnection = async (
  clientManager: McpClientManager,
  workflowManager: WorkflowManager,
  options: ExecuteToolOptions
) => {
  const { serverName, toolName, args } = options;

  if (!serverName || serverName.trim() === "") {
    return await workflowManager.execute(toolName, args);
  }

  const connection = clientManager.getConnection(serverName);

  if (!connection) {
    const availableServers = clientManager
      .getAllConnections()
      .map((conn) => conn.name)
      .join(", ");
    throw new Error(
      `Server "${serverName}" is not connected. Available servers: ${availableServers || "none"}. Please check the server name and connection status.`
    );
  }

  try {
    const toolsResult = await connection.client.listTools();
    const toolExists = toolsResult.tools.some((tool) => tool.name === toolName);

    if (!toolExists) {
      const availableTools = toolsResult.tools.map((t) => t.name).join(", ");
      throw new Error(
        `Tool "${toolName}" not found on server "${serverName}". Available tools: ${availableTools || "none"}`
      );
    }

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    });

    const toolResult = result as CallToolResult | undefined;
    return formatToolResult(toolResult, toolName, serverName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error executing tool "${toolName}" on server "${serverName}":`, error);

    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to execute tool "${toolName}" on server "${serverName}":\n\n${errorMessage}`,
        },
      ],
    };
  }
};

export const registerExecuteTool = (
  server: McpServer,
  clientManager: McpClientManager,
  workflowManager: WorkflowManager
): void => {
  server.registerTool(
    "execute",
    {
      title: "Execute",
      description:
        "Execute a tool from a connected MCP Client Server or a local workflow. Leave serverName empty to execute a local flow.",
      inputSchema: {
        serverName: z
          .string()
          .trim()
          .default("")
          .describe(
            "Name of the MCP server where the tool is located. Leave empty to execute a local flow."
          ),
        toolName: z.string().min(1).trim().describe("Name of the tool or flow to execute"),
        arguments: z
          .record(z.string(), z.unknown())
          .default({})
          .describe("Arguments to pass to the tool (JSON object)"),
      },
    },
    async (args: ExecuteArgs) => {
      return await executeToolFromConnection(clientManager, workflowManager, {
        serverName: args.serverName,
        toolName: args.toolName,
        args: args.arguments,
      });
    }
  );
};
