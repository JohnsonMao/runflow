import type { INodeExecutor } from "@bricks/core";
import { CodeNodeExecutor } from "./code";
import { IfNodeExecutor } from "./if";
import { SetNodeExecutor } from "./set";

export class NodeRegistry {
  private executors: Map<string, INodeExecutor> = new Map();

  constructor() {
    this.registerDefaultExecutors();
  }

  register(type: string, executor: INodeExecutor): void {
    this.executors.set(type, executor);
  }

  get(type: string): INodeExecutor | undefined {
    return this.executors.get(type);
  }

  has(type: string): boolean {
    return this.executors.has(type);
  }

  private registerDefaultExecutors(): void {
    this.register("set", new SetNodeExecutor());
    this.register("code", new CodeNodeExecutor());
    this.register("if", new IfNodeExecutor());
  }
}
