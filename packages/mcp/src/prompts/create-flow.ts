import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

const generateFlowId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const generateNodeId = (name: string, index: number): string => {
  const baseId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `node-${baseId}-${index}`;
};

const generateTriggerId = (): string => {
  return `trigger-mcp-tool-${Date.now()}`;
};

const generateTagId = (name: string): string => {
  return `tag-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
};

const calculateNodePosition = (index: number, baseY: number = 40): [number, number] => {
  const x = index * 220;
  return [x, baseY];
};

export const registerCreateFlowPrompt = (server: McpServer): void => {
  server.registerPrompt(
    "create-flow",
    {
      title: "Create Flow",
      description: "Generate a flow YAML file based on the provided description",
      argsSchema: {
        name: z.string().describe("Flow name"),
        description: z.string().optional().describe("Flow description"),
        inputSchema: z
          .object({
            type: z.literal("object"),
            properties: z.record(z.string(), z.any()).optional(),
            required: z.array(z.string()).optional(),
          })
          .optional()
          .describe("Input schema for the MCP tool trigger (JSON Schema format)"),
        nodes: z
          .array(
            z.object({
              name: z.string().describe("Node name"),
              type: z.enum(["set", "code", "if", "mcpTool"]).describe("Node type"),
              code: z.string().optional().describe("JavaScript code (required for code nodes)"),
              assignments: z
                .array(
                  z.object({
                    name: z.string(),
                    type: z.enum(["string", "number", "boolean"]),
                    value: z.string(),
                  })
                )
                .optional()
                .describe("Variable assignments (required for set nodes)"),
              conditions: z
                .object({
                  combinator: z.enum(["and", "or"]).optional(),
                  conditions: z.array(z.any()).optional(),
                })
                .optional()
                .describe("Conditions (required for if nodes)"),
              serverName: z.string().optional().describe("MCP server name (required for mcpTool nodes)"),
              toolName: z.string().optional().describe("Tool name (required for mcpTool nodes)"),
              toolArgs: z.record(z.string(), z.any()).optional().describe("Tool arguments (required for mcpTool nodes)"),
            })
          )
          .describe("Array of nodes to include in the flow"),
        connections: z
          .array(
            z.object({
              from: z.string().describe("Source node name"),
              to: z.string().describe("Target node name"),
              outputIndex: z.number().optional().default(0).describe("Output index for if nodes"),
            })
          )
          .optional()
          .describe("Connections between nodes"),
        tags: z.array(z.string()).optional().describe("Tags for the flow"),
        version: z.string().optional().default("1.0.0").describe("Flow version"),
      },
    },
    async ({ name, description, inputSchema, nodes, connections, tags, version }) => {
      const flowId = generateFlowId(name);
      const triggerId = generateTriggerId();

      const yamlLines: string[] = [];

      yamlLines.push(`id: "${flowId}"`);
      yamlLines.push(`name: "${name}"`);
      if (description) {
        yamlLines.push(`description: "${description}"`);
      }
      yamlLines.push(`version: "${version || "1.0.0"}"`);
      yamlLines.push(`active: true`);
      yamlLines.push("");

      if (tags && tags.length > 0) {
        yamlLines.push("tags:");
        for (const tag of tags) {
          const tagId = generateTagId(tag);
          yamlLines.push(`  - name: "${tag}"`);
          yamlLines.push(`    id: "${tagId}"`);
        }
        yamlLines.push("");
      }

      yamlLines.push("triggers:");
      yamlLines.push(`  - id: "${triggerId}"`);
      yamlLines.push(`    name: "MCP Tool Trigger"`);
      yamlLines.push(`    type: "mcpTool"`);
      yamlLines.push(`    parameters:`);
      yamlLines.push(`      title: "${name}"`);
      yamlLines.push(`      description: "${description || name}"`);
      if (inputSchema) {
        yamlLines.push(`      inputSchema:`);
        yamlLines.push(`        type: object`);
        if (inputSchema.properties) {
          yamlLines.push(`        properties:`);
          for (const [key, value] of Object.entries(inputSchema.properties)) {
            const prop = value as { type?: string; description?: string };
            yamlLines.push(`          ${key}:`);
            if (prop.type) {
              yamlLines.push(`            type: ${prop.type}`);
            }
            if (prop.description) {
              yamlLines.push(`            description: "${prop.description}"`);
            }
          }
        }
        if (inputSchema.required && inputSchema.required.length > 0) {
          yamlLines.push(`        required:`);
          for (const req of inputSchema.required) {
            yamlLines.push(`          - ${req}`);
          }
        }
      }
      yamlLines.push("");

      yamlLines.push("nodes:");
      const nodePositions: Map<string, [number, number]> = new Map();
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) {
          continue;
        }
        const nodeId = generateNodeId(node.name, i);
        const position = calculateNodePosition(i);
        nodePositions.set(node.name, position);

        yamlLines.push(`  - id: "${nodeId}"`);
        yamlLines.push(`    name: "${node.name}"`);
        yamlLines.push(`    type: "${node.type}"`);
        yamlLines.push(`    position: [${position[0]}, ${position[1]}]`);

        yamlLines.push(`    parameters:`);

        if (node.type === "code") {
          if (!node.code) {
            throw new Error(`Code node "${node.name}" requires a code parameter`);
          }
          yamlLines.push(`      language: "javascript"`);
          yamlLines.push(`      code: |`);
          const codeLines = node.code.split("\n");
          for (const line of codeLines) {
            yamlLines.push(`        ${line}`);
          }
        } else if (node.type === "set") {
          if (!node.assignments || node.assignments.length === 0) {
            throw new Error(`Set node "${node.name}" requires assignments`);
          }
          yamlLines.push(`      assignments:`);
          for (const assignment of node.assignments) {
            yamlLines.push(`        - name: "${assignment.name}"`);
            yamlLines.push(`          type: "${assignment.type}"`);
            yamlLines.push(`          value: "${assignment.value}"`);
          }
        } else if (node.type === "if") {
          if (!node.conditions) {
            throw new Error(`If node "${node.name}" requires conditions`);
          }
          yamlLines.push(`      conditions:`);
          if (node.conditions.combinator) {
            yamlLines.push(`        combinator: "${node.conditions.combinator}"`);
          }
          if (node.conditions.conditions) {
            yamlLines.push(`        conditions:`);
            for (const condition of node.conditions.conditions) {
              yamlLines.push(`          - ${JSON.stringify(condition)}`);
            }
          }
        } else if (node.type === "mcpTool") {
          if (!node.serverName || !node.toolName) {
            throw new Error(`MCP Tool node "${node.name}" requires serverName and toolName`);
          }
          yamlLines.push(`      serverName: "${node.serverName}"`);
          yamlLines.push(`      toolName: "${node.toolName}"`);
          if (node.toolArgs) {
            yamlLines.push(`      args:`);
            for (const [key, value] of Object.entries(node.toolArgs)) {
              yamlLines.push(`        ${key}: ${JSON.stringify(value)}`);
            }
          }
        }

        if (i < nodes.length - 1) {
          yamlLines.push("");
        }
      }

      yamlLines.push("");

      yamlLines.push("connections:");
      const connectionMap: Map<string, { main: Array<Array<{ node: string; type: string; index: number }>> }> =
        new Map();

      if (connections && connections.length > 0) {
        for (const conn of connections) {
          if (!connectionMap.has(conn.from)) {
            connectionMap.set(conn.from, { main: [] });
          }
          const connData = connectionMap.get(conn.from)!;
          connData.main.push([
            {
              node: conn.to,
              type: "main",
              index: conn.outputIndex || 0,
            },
          ]);
        }
      } else {
        for (let i = 0; i < nodes.length - 1; i++) {
          const fromNode = nodes[i];
          const toNode = nodes[i + 1];
          if (!fromNode || !toNode) {
            continue;
          }
          if (!connectionMap.has(fromNode.name)) {
            connectionMap.set(fromNode.name, { main: [] });
          }
          const connData = connectionMap.get(fromNode.name);
          if (connData) {
            connData.main.push([
              {
                node: toNode.name,
                type: "main",
                index: 0,
              },
            ]);
          }
        }
      }

      for (const [nodeName, conn] of connectionMap.entries()) {
        yamlLines.push(`  "${nodeName}":`);
        yamlLines.push(`    main:`);
        for (const targets of conn.main) {
          const target = targets[0];
          if (target) {
            yamlLines.push(`      - - node: "${target.node}"`);
            yamlLines.push(`          type: "${target.type}"`);
            yamlLines.push(`          index: ${target.index}`);
          }
        }
      }

      yamlLines.push("");
      yamlLines.push("settings:");
      yamlLines.push(`  timezone: "Asia/Taipei"`);
      yamlLines.push(`  executionOrder: "v1"`);
      yamlLines.push(`  timeout: 30000`);

      const yamlContent = yamlLines.join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Here is the generated flow YAML file:\n\n\`\`\`yaml\n${yamlContent}\n\`\`\`\n\nSave this content to a file in your workspace/flows directory (e.g., ${flowId}.yaml)`,
            },
          },
        ],
      };
    }
  );
};

