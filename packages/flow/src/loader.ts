import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { FlowParseError, parseFlowFromFile } from "./parser";
import type { Flow } from "./types";

export interface LoadOptions {
  recursive?: boolean;
  extensions?: string[];
}

const DEFAULT_EXTENSIONS = [".yaml", ".yml"];

export class FlowLoader {
  private flows: Map<string, Flow> = new Map();

  constructor(
    private basePath: string,
    private options: LoadOptions = {}
  ) {}

  async loadAll(): Promise<Flow[]> {
    const flows: Flow[] = [];
    const files = await this.findFlowFiles(this.basePath);

    for (const file of files) {
      try {
        const flow = await parseFlowFromFile(file);
        this.flows.set(flow.id, flow);
        flows.push(flow);
      } catch (error) {
        if (error instanceof FlowParseError) {
          console.error(`Failed to load flow from ${file}:`, error.message);
        } else {
          console.error(`Unexpected error loading flow from ${file}:`, error);
        }
      }
    }

    return flows;
  }

  async loadById(id: string): Promise<Flow | undefined> {
    if (this.flows.has(id)) {
      return this.flows.get(id);
    }

    await this.loadAll();
    return this.flows.get(id);
  }

  async loadByTriggerType(triggerType: "schedule" | "webhook" | "mcpTool"): Promise<Flow[]> {
    const flows = await this.loadAll();
    return flows.filter((flow) => flow.triggers?.some((trigger) => trigger.type === triggerType));
  }

  getLoadedFlows(): Flow[] {
    return Array.from(this.flows.values());
  }

  clearCache(): void {
    this.flows.clear();
  }

  private async findFlowFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = this.options.extensions ?? DEFAULT_EXTENSIONS;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (this.options.recursive) {
            const subFiles = await this.findFlowFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    return files;
  }
}

export function createFlowLoader(basePath: string, options?: LoadOptions): FlowLoader {
  return new FlowLoader(basePath, options);
}
