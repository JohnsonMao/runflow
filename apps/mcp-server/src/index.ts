// @env node
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { IStepHandler, StepRegistry } from '@runflow/core'
import type { DiscoverEntry, RunflowConfig } from '@runflow/workspace'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile, run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
import {
  buildDiscoverCatalog,
  createResolveFlow,
  DEFAULT_DISCOVER_LIMIT,
  findConfigFile,
  formatDetailAsMarkdown,
  formatListAsMarkdown,
  getDiscoverEntry,
  loadConfig,
  MAX_DISCOVER_LIMIT,
  resolveFlowId,
} from '@runflow/workspace'
import { createCommand } from 'commander'
import { z } from 'zod'

const program = createCommand()
program
  .name('runflow-mcp')
  .version('0.0.0')
  .option('-c, --config <path>', 'Path to runflow config file')
  .parse(process.argv)

const server = new McpServer({
  name: 'runflow',
  version: '0.0.0',
})

function getConfigPath(): string | null {
  const cwd = process.cwd()
  const configPath = program.opts().config
  if (configPath)
    return path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath)
  return findConfigFile(cwd)
}

export interface ConfigAndRegistry {
  config: RunflowConfig | null
  configDir: string
  registry: StepRegistry
}

type GetConfigAndRegistry = () => Promise<ConfigAndRegistry>

/** Performs one config load from current cwd (no cache). Useful when cwd or config location may change. */
export async function loadConfigOnce(): Promise<ConfigAndRegistry> {
  const cwd = process.cwd()
  const configPath = getConfigPath()
  const config = configPath ? await loadConfig(configPath) : null
  const configDir = configPath ? path.dirname(configPath) : cwd
  const registry = createBuiltinRegistry()
  if (config?.handlers && typeof config.handlers === 'object' && configPath) {
    for (const [type, modulePath] of Object.entries(config.handlers)) {
      if (typeof modulePath !== 'string')
        continue
      const resolved = path.resolve(configDir, modulePath)
      if (!existsSync(resolved) || !statSync(resolved).isFile())
        continue
      try {
        const mod = await import(pathToFileURL(resolved).href) as { default?: IStepHandler }
        const handler = mod.default
        if (handler && typeof handler.run === 'function')
          registry[type] = handler
      }
      catch {
        // skip failed handler
      }
    }
  }
  return { config, configDir, registry }
}

let cachedConfig: ConfigAndRegistry | null = null
let loadPromise: Promise<ConfigAndRegistry> | null = null

function getConfigAndRegistry(): Promise<ConfigAndRegistry> {
  if (cachedConfig)
    return Promise.resolve(cachedConfig)
  if (!loadPromise) {
    loadPromise = loadConfigOnce().then((r) => {
      cachedConfig = r
      return r
    })
  }
  return loadPromise
}

export { DEFAULT_MAX_DEPTH, DEFAULT_MAX_FILES, findFlowFiles } from '@runflow/workspace'
export type { DiscoverEntry, FindFlowFilesOptions } from '@runflow/workspace'

let cachedCatalog: DiscoverEntry[] | null = null
let catalogConfigSnapshot: { configDir: string, cwd: string } | null = null

async function getDiscoverCatalog(getConfig: GetConfigAndRegistry): Promise<DiscoverEntry[]> {
  const { config, configDir } = await getConfig()
  const cwd = process.cwd()
  if (cachedCatalog != null && catalogConfigSnapshot?.configDir === configDir && catalogConfigSnapshot?.cwd === cwd)
    return cachedCatalog
  const catalog = await buildDiscoverCatalog(config, configDir, cwd)
  cachedCatalog = catalog
  catalogConfigSnapshot = { configDir, cwd }
  return catalog
}

const listFlowsInputSchema = {
  limit: z.number().int().min(1).max(MAX_DISCOVER_LIMIT).optional().describe(`Max number of flows to return (max ${MAX_DISCOVER_LIMIT}). Default: ${DEFAULT_DISCOVER_LIMIT}`),
  offset: z.number().int().min(0).optional().describe('Number of flows to skip (for pagination). Default: 0.'),
  keyword: z.string().optional().describe('Filter by file name, flow name, or description containing this string (case-insensitive). Omit to list all.'),
}

/** discover_flow_list tool handler: list flows as compact table (flowId, name) with pagination hint. */
export async function discoverFlowListTool(
  args: { limit?: number, offset?: number, keyword?: string },
  getConfig: GetConfigAndRegistry = getConfigAndRegistry,
): Promise<CallToolResult> {
  const { limit = DEFAULT_DISCOVER_LIMIT, offset = 0, keyword } = args
  const catalog = await getDiscoverCatalog(getConfig)
  const keywordLower = keyword?.toLowerCase()
  const filtered = keywordLower == null
    ? catalog
    : catalog.filter(e =>
        e.flowId.toLowerCase().includes(keywordLower)
        || (e.name ?? '').toLowerCase().includes(keywordLower)
        || (e.description ?? '').toLowerCase().includes(keywordLower),
      )
  const text = formatListAsMarkdown(filtered, limit, offset)
  return {
    content: [{ type: 'text' as const, text }],
  }
}

/** Returns a function that loads config from current cwd on each call (no cache). Use when cwd or config may change between calls. */
export function createConfigLoader(): GetConfigAndRegistry {
  return () => loadConfigOnce()
}

const MARKER_STEP_ID_RE = /^\w+\.iteration_\d+$/

/** Format stepId for display: loop.iteration_1 → "loop [iteration 1]", loop.iteration_2 → "loop [iteration 2]". */
function formatStepIdDisplay(stepId: string): string {
  const m = stepId.match(/^(\w+)\.iteration_(\d+)$/)
  if (!m)
    return stepId
  const [, parent, num] = m
  return `${parent} [iteration ${num}]`
}

/** Format run result for MCP tool text content. No code block. Regular steps: "- ✓ id — log: ..." on one line; marker steps (iteration_0, iteration_1, ...): no "- " prefix. */
export function formatRunResult(result: Awaited<ReturnType<typeof run>>): string {
  const status = result.success ? '**Success**' : '**Failed**'
  const headline = `${status} — Flow "${result.flowName}" (${result.steps.length} step(s)).`
  const stepLines = result.steps.map((s) => {
    const displayId = formatStepIdDisplay(s.stepId)
    const isMarker = MARKER_STEP_ID_RE.test(s.stepId)
    if (isMarker) {
      return `  ${displayId}`
    }
    const badge = s.success ? '✓' : '✗'
    const extra: string[] = []
    if (!s.success && s.error)
      extra.push(`error: ${s.error}`)
    if (s.log?.trim())
      extra.push(`log: ${s.log.trim()}`)
    const suffix = extra.length ? ` — ${extra.join(' ')}` : ''
    return `- ${badge} ${displayId}${suffix}`
  })
  const stepsBlock = stepLines.length ? `\n\n${stepLines.join('\n')}` : ''
  if (!result.success) {
    const msg = result.error ?? 'Unknown error'
    const stepErrors = result.steps.filter(s => !s.success && s.error).map(s => `- Step "${s.stepId}": ${s.error}`).join('\n')
    return `${headline}\n\n${msg}${stepErrors ? `\n\n${stepErrors}` : ''}${stepsBlock}`
  }
  return `${headline}${stepsBlock}`
}

const runFlowInputSchema = {
  flowId: z.string().describe('Flow identifier: path to flow YAML (absolute or relative to flowsDir/cwd), or prefix-operation (e.g. my-api-get-users) when config openapi is used'),
  params: z.record(z.unknown()).optional().describe('Optional initial parameters for the flow'),
}

/** Execute tool handler: run a flow by flowId. Optional getConfig uses cached load when omitted. */
export async function executeTool(
  args: { flowId: string, params?: Record<string, unknown> },
  getConfig: GetConfigAndRegistry = getConfigAndRegistry,
): Promise<CallToolResult> {
  const { flowId, params } = args
  const cwd = process.cwd()
  const { config, configDir, registry } = await getConfig()
  const resolved = resolveFlowId(flowId, config, configDir, cwd)
  let flow: Awaited<ReturnType<typeof loadFromFile>>
  let flowFilePath: string | undefined
  if (resolved.type === 'openapi') {
    if (!existsSync(resolved.specPath) || !statSync(resolved.specPath).isFile()) {
      return {
        content: [{ type: 'text' as const, text: `OpenAPI spec not found: ${resolved.specPath}` }],
        isError: true,
      }
    }
    const flows = await openApiToFlows(resolved.specPath, { ...resolved.options, output: 'memory' })
    const selected = flows.get(resolved.operation)
    if (!selected) {
      const keys = [...flows.keys()].slice(0, 10).join(', ')
      return {
        content: [{ type: 'text' as const, text: `Operation "${resolved.operation}" not found. Available (sample): ${keys}${flows.size > 10 ? '...' : ''}` }],
        isError: true,
      }
    }
    flow = selected
    flowFilePath = resolved.specPath
  }
  else {
    if (!existsSync(resolved.path) || !statSync(resolved.path).isFile()) {
      return {
        content: [{ type: 'text' as const, text: `File not found or not a regular file: ${resolved.path}` }],
        isError: true,
      }
    }
    flow = loadFromFile(resolved.path)
    flowFilePath = resolved.path
  }
  if (!flow) {
    return {
      content: [{ type: 'text' as const, text: `Invalid flow YAML or failed to load.` }],
      isError: true,
    }
  }
  const resolveFlow = createResolveFlow(config, configDir, cwd)
  const effectiveParams = { ...(config?.params ?? {}), ...(params ?? {}) }
  try {
    const result = await run(flow, {
      registry,
      params: Object.keys(effectiveParams).length ? effectiveParams : undefined,
      flowFilePath,
      resolveFlow,
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
}

server.registerTool(
  'executor_flow',
  {
    description: 'Run a flow by flowId (file path or prefix-operation from config openapi). Returns success summary or error message.',
    inputSchema: runFlowInputSchema,
  },
  args => executeTool(args),
)

server.registerTool(
  'discover_flow_list',
  {
    description: 'List flows from config (flowsDir YAML + OpenAPI) as compact table: flowId, name, type (file|openapi). Use keyword, limit, offset; pagination hint when more results exist.',
    inputSchema: listFlowsInputSchema,
  },
  args => discoverFlowListTool(args),
)

const discoverFlowDetailInputSchema = {
  flowId: z.string().describe('Flow identifier to look up in the catalog (file path or prefix-operation).'),
}

/** discover_flow_detail tool handler: return one flow's name, description, params by flowId. */
export async function discoverFlowDetailTool(
  args: { flowId: string },
  getConfig: GetConfigAndRegistry = getConfigAndRegistry,
): Promise<CallToolResult> {
  const { flowId } = args
  const catalog = await getDiscoverCatalog(getConfig)
  const entry = getDiscoverEntry(catalog, flowId)
  if (!entry) {
    return {
      content: [{ type: 'text' as const, text: `Flow not found: ${flowId}` }],
      isError: true,
    }
  }
  const text = formatDetailAsMarkdown(entry)
  return {
    content: [{ type: 'text' as const, text }],
  }
}

server.registerTool(
  'discover_flow_detail',
  {
    description: 'Get one flow\'s full detail (name, description, params) by flowId from the catalog.',
    inputSchema: discoverFlowDetailInputSchema,
  },
  args => discoverFlowDetailTool(args),
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
main()
