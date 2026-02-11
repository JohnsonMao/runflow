// @env node
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadFromFile, run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
import { z } from 'zod'

const server = new McpServer({
  name: 'runflow',
  version: '0.0.0',
})

function formatRunResult(result: Awaited<ReturnType<typeof run>>): string {
  if (result.success) {
    const stepCount = result.steps.length
    const summary = `Flow "${result.flowName}" completed. Steps: ${stepCount}.`
    return summary
  }
  const parts: string[] = [result.error ?? 'Unknown error']
  const failedStep = result.steps.find(s => !s.success && s.error)
  if (failedStep)
    parts.push(`Step "${failedStep.stepId}": ${failedStep.error}`)
  return parts.join(' ')
}

const runFlowInputSchema = {
  flowPath: z.string().describe('Path to the flow YAML file (absolute or relative to cwd)'),
  params: z.record(z.unknown()).optional().describe('Optional initial parameters for the flow'),
}

server.registerTool(
  'run_flow',
  {
    description: 'Run a flow YAML file. Returns success summary or error message.',
    inputSchema: runFlowInputSchema,
  },
  async ({ flowPath, params }) => {
    const resolvedPath = path.isAbsolute(flowPath)
      ? path.resolve(flowPath)
      : path.resolve(process.cwd(), flowPath)

    if (!existsSync(resolvedPath)) {
      return {
        content: [{ type: 'text' as const, text: `File not found: ${resolvedPath}` }],
        isError: true,
      }
    }

    const flow = loadFromFile(resolvedPath)
    if (!flow) {
      return {
        content: [{ type: 'text' as const, text: `Invalid flow YAML or failed to load: ${resolvedPath}` }],
        isError: true,
      }
    }

    try {
      const registry = createBuiltinRegistry()
      const result = await run(flow, {
        registry,
        params: params ?? {},
        flowFilePath: resolvedPath,
      })
      const text = formatRunResult(result)
      return {
        content: [{ type: 'text' as const, text }],
        isError: !result.success,
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `Run error: ${message}` }],
        isError: true,
      }
    }
  },
)

function findFlowFiles(dir: string, extensions: readonly string[]): string[] {
  const base = path.resolve(process.cwd(), dir)
  if (!existsSync(base) || !statSync(base).isDirectory())
    return []
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.'))
        walk(full)
      else if (e.isFile() && extensions.some(ext => e.name.toLowerCase().endsWith(ext)))
        out.push(full)
    }
  }
  walk(base)
  return out
}

const listFlowsInputSchema = {
  directory: z.string().optional().describe('Directory to search (relative to cwd). Default: current working directory'),
  extension: z.enum(['yaml', 'yml', 'both']).optional().describe('Include .yaml, .yml, or both. Default: yaml'),
}

server.registerTool(
  'list_flows',
  {
    description: 'List flow files in a directory (recursive). Returns path, name, and optional description for each valid flow.',
    inputSchema: listFlowsInputSchema,
  },
  async ({ directory = '.', extension = 'yaml' }) => {
    const ext = extension === 'both' ? ['.yaml', '.yml'] : [`.${extension}`]
    const flowFiles = findFlowFiles(directory, ext)
    const list: Array<{ path: string, name: string, description?: string }> = []
    for (const filePath of flowFiles) {
      const flow = loadFromFile(filePath)
      if (flow)
        list.push({ path: filePath, name: flow.name, description: flow.description })
    }
    const base = path.resolve(process.cwd(), directory)
    const text = list.length === 0
      ? `No flows found in ${base} (extension: ${extension}).`
      : JSON.stringify(list, null, 2)
    return {
      content: [{ type: 'text' as const, text }],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
main()
