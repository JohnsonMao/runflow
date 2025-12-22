import type { INodeExecutionContext, INodeExecutionResult } from "@bricks/core";
import type { NodeRegistry } from "@bricks/nodes";
import { ExecutionContext } from "./expression/context";
import { ExpressionEvaluator } from "./expression/evaluator";
import type { Flow } from "./types";

export interface FlowExecutionOptions {
  nodeRegistry: NodeRegistry;
  initialInput?: Array<Record<string, unknown>>;
  onNodeExecute?: (nodeName: string, nodeType: string) => void;
}

export interface FlowExecutionResult {
  result: Record<string, unknown>;
  nodeResults: Map<string, INodeExecutionResult[]>;
}

export class FlowExecutor {
  private context: ExecutionContext;
  private evaluator: ExpressionEvaluator;

  constructor(private options: FlowExecutionOptions) {
    this.context = new ExecutionContext(options.initialInput);
    this.evaluator = new ExpressionEvaluator();
  }

  async execute(flow: Flow): Promise<FlowExecutionResult> {
    const nodeResults = new Map<string, INodeExecutionResult[]>();

    const getNodeByName = (name: string) => {
      return flow.nodes.find((node) => node.name === name);
    };

    const getNextNodes = (nodeName: string, outputIndex: number = 0) => {
      const connection = flow.connections[nodeName];
      if (!connection || !connection.main[outputIndex]) {
        return [];
      }
      return connection.main[outputIndex].map((target) => target.node);
    };

    const executeNode = async (
      nodeName: string,
      inputData: Array<Record<string, unknown>>
    ): Promise<INodeExecutionResult[]> => {
      const node = getNodeByName(nodeName);
      if (!node) {
        throw new Error(`Node "${nodeName}" not found`);
      }

      if (this.options.onNodeExecute) {
        this.options.onNodeExecute(nodeName, node.type);
      }

      const executor = this.options.nodeRegistry.get(node.type);
      if (!executor) {
        throw new Error(`No executor found for node type "${node.type}"`);
      }

      const ctx: INodeExecutionContext = {
        node: {
          id: node.id,
          name: node.name,
          type: node.type,
          parameters: node.parameters,
          position: node.position,
        },
        context: this.context,
        evaluator: this.evaluator,
        input: inputData,
      };

      const result = await executor.execute(ctx);
      const results = Array.isArray(result) ? result : [result];
      nodeResults.set(nodeName, results);

      return results;
    };

    const executeNodeRecursive = async (
      nodeName: string,
      inputData: Array<Record<string, unknown>>
    ): Promise<void> => {
      const results = await executeNode(nodeName, inputData);

      const node = getNodeByName(nodeName);
      if (!node) {
        return;
      }

      if (node.type === "if") {
        const hasTrueBranch = results.length > 0 && !results[0]?.error && results[0]?.json?.result === true;
        const outputIndex = hasTrueBranch ? 0 : 1;
        const nextNodes = getNextNodes(nodeName, outputIndex);
        for (const nextNodeName of nextNodes) {
          await executeNodeRecursive(
            nextNodeName,
            hasTrueBranch ? inputData : inputData
          );
        }
      } else {
        const nextNodes = getNextNodes(nodeName, 0);
        for (const nextNodeName of nextNodes) {
          await executeNodeRecursive(
            nextNodeName,
            results.map((r) => ({ json: r.json }))
          );
        }
      }
    };

    const startNodes = flow.nodes.filter((node) => {
      const nodeName = node.name;
      return !Object.values(flow.connections).some((conn) =>
        conn.main.some((outputs) => outputs.some((target) => target.node === nodeName))
      );
    });

    if (startNodes.length === 0) {
      throw new Error("No start nodes found in flow");
    }

    for (const startNode of startNodes) {
      const initialInput = this.options.initialInput || [{ json: {} }];
      await executeNodeRecursive(startNode.name, initialInput);
    }

    const allResults = Array.from(nodeResults.values()).flat();
    if (allResults.length === 0) {
      return {
        result: { success: true, message: "Flow executed successfully" },
        nodeResults,
      };
    }

    const lastResult = allResults[allResults.length - 1];
    return {
      result: lastResult?.json || {},
      nodeResults,
    };
  }
}
