import yaml from "js-yaml";
import type { Flow } from "./types";
import { FlowSchema } from "./types";

export interface ParseOptions {
  strict?: boolean;
}

export class FlowParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "FlowParseError";
  }
}

export function parseFlow(yamlContent: string): Flow {
  try {
    const parsed = yaml.load(yamlContent, {
      schema: yaml.DEFAULT_SCHEMA,
    });

    if (!parsed || typeof parsed !== "object") {
      throw new FlowParseError("YAML content must be an object");
    }

    const result = FlowSchema.safeParse(parsed);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new FlowParseError(`Flow validation failed: ${errors}`, result.error);
    }

    return result.data;
  } catch (error) {
    if (error instanceof FlowParseError) {
      throw error;
    }

    if (error instanceof yaml.YAMLException) {
      throw new FlowParseError(`YAML parsing failed: ${error.message}`, error);
    }

    throw new FlowParseError(
      `Failed to parse flow: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

export async function parseFlowFromFile(filePath: string): Promise<Flow> {
  try {
    const { readFile } = await import("node:fs/promises");
    const yamlContent = await readFile(filePath, "utf-8");
    return parseFlow(yamlContent);
  } catch (error) {
    if (error instanceof FlowParseError) {
      throw error;
    }

    throw new FlowParseError(
      `Failed to read flow file "${filePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      error
    );
  }
}
