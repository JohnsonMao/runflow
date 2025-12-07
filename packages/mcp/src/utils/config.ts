import { readFileSync } from "node:fs";
import { z } from "zod";

export const McpServerConfigSchema = z.union([
  z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    url: z.string(),
  }),
]);

export const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema),
});

export type McpServerConfigType = z.infer<typeof McpServerConfigSchema>;
export type McpConfigType = z.infer<typeof McpConfigSchema>;

export function loadConfig(configPath: string): McpConfigType {
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    const config = McpConfigSchema.parse(parsed);
    return config;
  } catch (error) {
    throw new Error(
      `Failed to load config from ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
