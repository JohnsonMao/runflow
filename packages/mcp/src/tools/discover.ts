import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import type { McpClientManager } from "../client";
import { logger } from "../utils";

interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface ServerToolsResult {
  serverName: string;
  tools: ToolInfo[];
}

interface CapabilityItem {
  serverName: string;
  tool: ToolInfo;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalFound: number;
}

interface DiscoverArgs {
  keyword: string;
  limit: number;
  offset: number;
}

const filterToolsByKeyword = (tools: ToolInfo[], keyword: string): ToolInfo[] => {
  const lowerKeyword = keyword.toLowerCase();
  return tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(lowerKeyword) ||
      tool.description?.toLowerCase().includes(lowerKeyword)
  );
};

const flattenServerTools = (results: ServerToolsResult[]): CapabilityItem[] => {
  const capabilities: CapabilityItem[] = [];

  for (const result of results) {
    for (const tool of result.tools) {
      capabilities.push({
        serverName: result.serverName,
        tool,
      });
    }
  }

  return capabilities;
};

const calculatePagination = (totalFound: number, limit: number, offset: number): PaginationInfo => {
  const startIndex = offset;
  const endIndex = Math.min(offset + limit, totalFound);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalFound / limit);

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalFound,
  };
};

const formatCapabilityDescription = (description?: string): string => {
  if (!description) {
    return "";
  }
  return description.split("\n")[0]?.trim() ?? "";
};

const formatCapabilityItem = (item: CapabilityItem): string => {
  const description = formatCapabilityDescription(item.tool.description);
  const descriptionText = description ? ` - ${description}` : "";
  return `• ${item.serverName}:${item.tool.name}${descriptionText}`;
};

const formatToolsAsText = (
  results: ServerToolsResult[],
  keyword: string,
  limit: number,
  offset: number
): string => {
  const allCapabilities = flattenServerTools(results);
  const pagination = calculatePagination(allCapabilities.length, limit, offset);
  const paginatedCapabilities = allCapabilities.slice(pagination.startIndex, pagination.endIndex);

  let text = `🔍 Search Results for "${keyword}"\n`;
  text += `Found ${pagination.totalFound} capability(ies) | Page ${pagination.currentPage}/${pagination.totalPages} | Showing ${pagination.startIndex + 1}-${pagination.endIndex}\n\n`;

  if (paginatedCapabilities.length === 0) {
    text += `No results found for this page.`;
    return text.trim();
  }

  for (const capability of paginatedCapabilities) {
    text += `${formatCapabilityItem(capability)}\n`;
  }

  const remainingCount = pagination.totalFound - pagination.endIndex;
  if (remainingCount > 0) {
    text += `\n... and ${remainingCount} more capability(ies)`;
  }

  return text.trim();
};

const normalizeToolInfo = (tool: {
  name: string;
  description?: string;
  inputSchema?: unknown;
}): ToolInfo => {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
};

const discoverFromConnections = async (
  clientManager: McpClientManager,
  keyword: string
): Promise<ServerToolsResult[]> => {
  const connections = clientManager.getAllConnections();
  const results: ServerToolsResult[] = [];

  for (const connection of connections) {
    try {
      const toolsResult = await connection.client.listTools();
      const normalizedTools = toolsResult.tools.map(normalizeToolInfo);
      const filteredTools = filterToolsByKeyword(normalizedTools, keyword);

      if (filteredTools.length > 0) {
        results.push({
          serverName: connection.name,
          tools: filteredTools,
        });
      }
    } catch (error) {
      logger.error(`Error searching capabilities from ${connection.name}:`, error);
    }
  }

  return results;
};

export const registerDiscoverTool = (server: McpServer, clientManager: McpClientManager): void => {
  server.registerTool(
    "discover",
    {
      title: "Discover",
      description:
        "Search and discover available capabilities (tools, workflows) from connected MCP Client Servers by keyword. Supports pagination with offset and limit.",
      inputSchema: {
        keyword: z
          .string()
          .min(1)
          .trim()
          .describe("Keyword to search for capabilities by name or description"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Number of results per page (default: 10, max: 50)"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of results to skip for pagination (default: 0)"),
      },
    },
    async (args: DiscoverArgs) => {
      const results = await discoverFromConnections(clientManager, args.keyword);
      const text = formatToolsAsText(results, args.keyword, args.limit, args.offset);

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
      };
    }
  );
};
