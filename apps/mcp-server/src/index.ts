// @env node
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { RunflowConfig } from '@runflow/config'
import type { IStepHandler, ParamDeclaration, StepRegistry } from '@runflow/core'
import { existsSync, lstatSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { findConfigFile, loadConfig, resolveFlowId } from '@runflow/config'
import { openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile, run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
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
  const envPath = process.env.RUNFLOW_CONFIG
  if (envPath)
    return path.isAbsolute(envPath) ? envPath : path.resolve(cwd, envPath)
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

export const DEFAULT_MAX_DEPTH = 32
export const DEFAULT_MAX_FILES = 1000

export interface DiscoverEntry {
  flowId: string
  name: string
  description?: string
  params?: ParamDeclaration[]
}

/** Build discover catalog: file flows from flowsDir + OpenAPI flows from config.openapi. Same lifecycle as config (no invalidation). */
export async function buildDiscoverCatalog(
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): Promise<DiscoverEntry[]> {
  const baseDir = config?.flowsDir ? path.resolve(configDir, config.flowsDir) : cwd
  const entries: DiscoverEntry[] = []

  const flowFiles = findFlowFiles(baseDir, ['.yaml'], {
    allowedRoot: baseDir,
    maxDepth: DEFAULT_MAX_DEPTH,
    maxFiles: DEFAULT_MAX_FILES,
  })
  for (const filePath of flowFiles) {
    const flow = loadFromFile(filePath)
    if (!flow)
      continue
    const flowId = path.relative(baseDir, filePath)
    entries.push({
      flowId: flowId || filePath,
      name: flow.name,
      description: flow.description,
      params: flow.params,
    })
  }

  const openapi = config?.openapi && typeof config.openapi === 'object' ? config.openapi : null
  if (openapi) {
    for (const [prefix, entry] of Object.entries(openapi)) {
      if (!entry || typeof entry.specPath !== 'string')
        continue
      const specPath = path.isAbsolute(entry.specPath) ? entry.specPath : path.resolve(configDir, entry.specPath)
      if (!existsSync(specPath) || !statSync(specPath).isFile())
        continue
      try {
        const options: Parameters<typeof openApiToFlows>[1] = { output: 'memory' }
        if (entry.baseUrl !== undefined)
          options.baseUrl = entry.baseUrl
        if (entry.operationFilter !== undefined)
          options.operationFilter = entry.operationFilter
        if (entry.hooks !== undefined)
          options.hooks = entry.hooks
        const flows = await openApiToFlows(specPath, options)
        for (const [operationKey, flow] of flows) {
          entries.push({
            flowId: `${prefix}-${operationKey}`,
            name: flow.name,
            description: flow.description,
            params: flow.params,
          })
        }
      }
      catch {
        // skip failed prefix
      }
    }
  }

  return entries
}

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

const API_PARAM_INS = new Set<ParamDeclaration['in']>(['path', 'query', 'body'])

function formatOneParam(p: ParamDeclaration, indent = ''): string[] {
  const lines: string[] = []
  const req = p.required === true ? ', required' : ''
  const desc = p.description ? ` — ${p.description.replace(/\n/g, ' ')}` : ''
  lines.push(`${indent}- **${p.name}** (${p.type}${req})${desc}`)
  if (p.type === 'object' && p.schema && Object.keys(p.schema).length > 0) {
    for (const [k, v] of Object.entries(p.schema)) {
      const req2 = v.required === true ? ', required' : ''
      const desc2 = v.description ? ` — ${v.description.replace(/\n/g, ' ')}` : ''
      lines.push(`${indent}  - **${k}** (${v.type}${req2})${desc2}`)
    }
  }
  return lines
}

function formatParamsSummary(params: ParamDeclaration[] | undefined): string {
  if (!params?.length)
    return ''
  const hasIn = params.some(p => p.in != null)
  const filtered = hasIn ? params.filter(p => p.in != null && API_PARAM_INS.has(p.in)) : params
  if (!filtered.length)
    return ''
  const lines: string[] = []
  for (const p of filtered)
    lines.push(...formatOneParam(p))
  return lines.join('\n')
}

function formatDiscoverMarkdown(entries: DiscoverEntry[], limit: number, offset: number): string {
  const total = entries.length
  const slice = entries.slice(offset, offset + limit)
  if (slice.length === 0)
    return total === 0 ? 'No flows found.' : `Total: ${total} flows. No flows in this range (offset ${offset}).`
  const start = offset + 1
  const end = offset + slice.length
  const rangeLine = `Total: ${total} flows. Showing ${start}-${end}.\n\n`
  const intro = `${rangeLine}flowId 若有斜線：檔案型為相對於 flowsDir 的相對路徑（子目錄會有斜線）；OpenAPI 型為 prefix-operation。\n\n`
  const blocks = slice.map((e) => {
    const flowId = e.flowId.replace(/\n/g, ' ')
    const name = (e.name ?? '').replace(/\n/g, ' ')
    const desc = (e.description ?? '').replace(/\n/g, ' ')
    const paramsBlock = formatParamsSummary(e.params)
    const parts = [
      `- **flowId**: ${flowId}`,
      `- **name**: ${name}`,
      `- **description**: ${desc}`,
    ]
    if (paramsBlock)
      parts.push(`- **params**:\n${paramsBlock.split('\n').map(l => `  ${l}`).join('\n')}`)
    return parts.join('\n')
  })
  return `${intro}${blocks.join('\n\n---\n\n')}`
}

/** Returns a function that loads config from current cwd on each call (no cache). Use when cwd or config may change between calls. */
export function createConfigLoader(): GetConfigAndRegistry {
  return () => loadConfigOnce()
}

/** Format run result for MCP tool text content. Shows success/failure and per-step status + log. */
export function formatRunResult(result: Awaited<ReturnType<typeof run>>): string {
  const status = result.success ? '**Success**' : '**Failed**'
  const headline = `${status} — Flow "${result.flowName}" (${result.steps.length} step(s)).`
  const stepLines = result.steps.map((s) => {
    const badge = s.success ? '✓' : '✗'
    const parts = [`- ${badge} ${s.stepId}`]
    if (!s.success && s.error)
      parts.push(`  error: ${s.error}`)
    if (s.log?.trim())
      parts.push(`  log: ${s.log.trim()}`)
    return parts.join('\n')
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
  const effectiveParams = { ...(config?.params ?? {}), ...(params ?? {}) }
  try {
    const result = await run(flow, {
      registry,
      params: Object.keys(effectiveParams).length ? effectiveParams : undefined,
      flowFilePath,
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
  'execute',
  {
    description: 'Run a flow by flowId (file path or prefix-operation from config openapi). Returns success summary or error message.',
    inputSchema: runFlowInputSchema,
  },
  args => executeTool(args),
)

export interface FindFlowFilesOptions {
  /** If set, baseDir must be under this path (resolved); otherwise returns []. */
  allowedRoot?: string
  /** Maximum recursion depth (default DEFAULT_MAX_DEPTH). */
  maxDepth?: number
  /** Stop after collecting this many file paths (default DEFAULT_MAX_FILES). */
  maxFiles?: number
}

/** Recursively find flow files in baseDir by extension. Does not follow symlinks. */
export function findFlowFiles(
  baseDir: string,
  extensions: readonly string[],
  options: FindFlowFilesOptions = {},
): string[] {
  const base = path.resolve(baseDir)
  if (!existsSync(base))
    return []
  const stat = lstatSync(base)
  if (stat.isSymbolicLink())
    return []
  if (!stat.isDirectory())
    return []
  const allowedRoot = options.allowedRoot != null ? path.resolve(options.allowedRoot) : undefined
  if (allowedRoot != null) {
    const rel = path.relative(allowedRoot, base)
    if (rel.startsWith('..') || path.isAbsolute(rel))
      return []
  }
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const out: string[] = []
  const state = { stopped: false }
  const walk = (d: string, depth: number) => {
    if (state.stopped || depth > maxDepth) {
      return
    }
    let entries: Array<{ name: string, isDirectory: () => boolean, isFile: () => boolean, isSymbolicLink: () => boolean }>
    try {
      entries = readdirSync(d, { withFileTypes: true }) as typeof entries
    }
    catch {
      return
    }
    for (const e of entries) {
      if (state.stopped) {
        break
      }
      if (e.isSymbolicLink()) {
        continue
      }
      const name = String(e.name)
      const full = path.join(d, name)
      if (e.isDirectory() && name !== 'node_modules' && !name.startsWith('.')) {
        walk(full, depth + 1)
      }
      else if (e.isFile() && extensions.some(ext => name.toLowerCase().endsWith(ext))) {
        out.push(full)
        if (out.length >= maxFiles) {
          state.stopped = true
        }
      }
    }
  }
  walk(base, 0)
  return out
}

const DEFAULT_DISCOVER_LIMIT = 10
const MAX_DISCOVER_LIMIT = 10

const listFlowsInputSchema = {
  limit: z.number().int().min(1).max(MAX_DISCOVER_LIMIT).optional().describe(`Max number of flows to return (max ${MAX_DISCOVER_LIMIT}). Default: ${DEFAULT_DISCOVER_LIMIT}`),
  offset: z.number().int().min(0).optional().describe('Number of flows to skip (for pagination). Default: 0.'),
  keyword: z.string().optional().describe('Filter by file name, flow name, or description containing this string (case-insensitive). Omit to list all.'),
}

/** Discover tool handler: lists flows from cached catalog (flowsDir + OpenAPI). Filter by keyword; optional offset for pagination; output includes total count and flowId, name, description, params (path/query/body only; body expanded). */
export async function discoverTool(
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
  const text = formatDiscoverMarkdown(filtered, limit, offset)
  return {
    content: [{ type: 'text' as const, text }],
  }
}

server.registerTool(
  'discover',
  {
    description: 'List flows from config (flowsDir YAML + OpenAPI). Returns total count and list: flowId, name, description, params (path/query/body only). Default limit 10, max 10. Use offset for pagination; keyword to filter (case-insensitive).',
    inputSchema: listFlowsInputSchema,
  },
  args => discoverTool(args),
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
main()
