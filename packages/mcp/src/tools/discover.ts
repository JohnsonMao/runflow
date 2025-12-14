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
  tools: Array<ToolInfo & { relevanceScore?: number }>;
}

interface CapabilityItem {
  serverName: string;
  tool: ToolInfo;
  relevanceScore?: number;
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

const tokenizeKeyword = (keyword: string): string[] => {
  return keyword
    .toLowerCase()
    .trim()
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);
};

const calculateRelevanceScore = (tool: ToolInfo, keywords: string[]): number => {
  const toolName = tool.name.toLowerCase();
  const toolDescription = (tool.description || "").toLowerCase();
  let score = 0;
  let matchedKeywords = 0;

  if (keywords.length === 0) return 0;

  const firstKeyword = keywords[0];
  if (!firstKeyword) return 0;

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    if (!keyword) continue;

    const nameScore = calculateMatchScore(toolName, keyword);
    const descriptionScore = calculateMatchScore(toolDescription, keyword);

    if (nameScore > 0 || descriptionScore > 0) {
      matchedKeywords++;
      const keywordWeight = i === 0 ? 1.5 : 1.0;
      score += nameScore * 3 * keywordWeight;
      score += descriptionScore * 1 * keywordWeight;
    }
  }

  if (matchedKeywords === 0) return 0;

  if (toolName.startsWith(firstKeyword)) {
    score += 10;
  }

  if (toolDescription.includes(firstKeyword)) {
    score += 5;
  }

  const matchRatio = matchedKeywords / keywords.length;
  const bonusScore = Math.floor(score * matchRatio * 0.3);

  return score + bonusScore;
};

const calculateMatchScore = (text: string, keyword: string): number => {
  if (!text || !keyword) return 0;

  const exactMatch = text === keyword;
  if (exactMatch) return 100;

  const startsWith = text.startsWith(keyword);
  if (startsWith) return 50;

  const includes = text.includes(keyword);
  if (includes) return 30;

  const wordBoundaryMatch = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "i"
  ).test(text);
  if (wordBoundaryMatch) return 20;

  const fuzzyScore = calculateFuzzyScore(text, keyword);
  return fuzzyScore;
};

const calculateFuzzyScore = (text: string, keyword: string): number => {
  const keywordChars = keyword.split("");
  let matchedChars = 0;
  let textIndex = 0;

  for (const char of keywordChars) {
    const foundIndex = text.indexOf(char, textIndex);
    if (foundIndex !== -1) {
      matchedChars++;
      textIndex = foundIndex + 1;
    }
  }

  if (matchedChars === 0) return 0;

  const ratio = matchedChars / keywordChars.length;
  return Math.floor(ratio * 10);
};

const filterAndRankToolsByKeyword = (
  tools: ToolInfo[],
  keyword: string,
  minScore: number = 1
): Array<ToolInfo & { relevanceScore: number }> => {
  const keywords = tokenizeKeyword(keyword);
  if (keywords.length === 0) {
    return [];
  }

  const scoredTools = tools
    .map((tool) => ({
      ...tool,
      relevanceScore: calculateRelevanceScore(tool, keywords),
    }))
    .filter((tool) => tool.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scoredTools;
};

const flattenServerTools = (results: ServerToolsResult[]): CapabilityItem[] => {
  const items: CapabilityItem[] = results.flatMap((result) =>
    result.tools.map((tool) => ({
      serverName: result.serverName,
      tool,
      relevanceScore: tool.relevanceScore,
    }))
  );

  return items.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
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

const extractParametersFromSchema = (inputSchema: unknown): string => {
  if (!inputSchema || typeof inputSchema !== "object") {
    return "";
  }

  const schema = inputSchema as Record<string, unknown>;
  const properties = schema.properties as Record<string, unknown> | undefined;
  const required = (schema.required as string[] | undefined) || [];

  if (!properties || Object.keys(properties).length === 0) {
    return "";
  }

  const paramDescriptions: string[] = [];

  for (const [paramName, paramSchema] of Object.entries(properties)) {
    if (typeof paramSchema !== "object" || paramSchema === null) {
      continue;
    }

    const param = paramSchema as Record<string, unknown>;
    const isRequired = required.includes(paramName);
    const paramType = getParameterType(param);
    const description = typeof param.description === "string" ? param.description : "";
    const defaultValue =
      param.default !== undefined ? ` (default: ${JSON.stringify(param.default)})` : "";

    const requiredMark = isRequired ? "[required] " : "";
    const paramInfo = description
      ? `${requiredMark}${paramName}: ${paramType}${defaultValue} - ${description}`
      : `${requiredMark}${paramName}: ${paramType}${defaultValue}`;

    paramDescriptions.push(paramInfo);
  }

  if (paramDescriptions.length === 0) {
    return "";
  }

  return `\n  Parameters:\n    ${paramDescriptions.join("\n    ")}`;
};

const getParameterType = (param: Record<string, unknown>): string => {
  if (param.type) {
    return String(param.type);
  }
  if (Array.isArray(param.anyOf)) {
    return param.anyOf
      .map((item: unknown) => {
        if (typeof item === "object" && item !== null && "type" in item) {
          return (item as Record<string, unknown>).type;
        }
        return "unknown";
      })
      .join(" | ");
  }
  if (Array.isArray(param.oneOf)) {
    return param.oneOf
      .map((item: unknown) => {
        if (typeof item === "object" && item !== null && "type" in item) {
          return (item as Record<string, unknown>).type;
        }
        return "unknown";
      })
      .join(" | ");
  }
  return "unknown";
};

const formatCapabilityItem = (item: CapabilityItem): string => {
  const description = formatCapabilityDescription(item.tool.description);
  const descriptionText = description ? ` - ${description}` : "";
  const parameters = extractParametersFromSchema(item.tool.inputSchema);
  return `• ${item.serverName}:${item.tool.name}${descriptionText}${parameters}`;
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

  let text = `Search Results for "${keyword}"\n`;
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

  const queryPromises = connections.map(async (connection) => {
    try {
      const toolsResult = await connection.client.listTools();
      const normalizedTools = toolsResult.tools.map(normalizeToolInfo);
      const filteredTools = filterAndRankToolsByKeyword(normalizedTools, keyword);

      return {
        serverName: connection.name,
        tools: filteredTools,
      };
    } catch (error) {
      logger.error(`Error searching capabilities from ${connection.name}:`, error);
      return null;
    }
  });

  const results = await Promise.all(queryPromises);
  return results.filter((result) => result !== null);
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
          .describe(
            "Keyword(s) to search for capabilities by name or description. Multiple keywords can be separated by comma or space (e.g., 'read,file' or 'read file')"
          ),
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
