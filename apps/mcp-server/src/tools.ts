import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { StepRegistry } from '@runflow/core'
import type { DiscoverEntry, RunflowConfig } from '@runflow/workspace'
import { run } from '@runflow/core'
import {
  buildFlowMapForRun,
  createResolveFlow,
  DEFAULT_DISCOVER_LIMIT,
  formatDetailAsMarkdown,
  formatListAsMarkdown,
  getDiscoverEntry,
  MAX_DISCOVER_LIMIT,
  mergeParamDeclarations,
  resolveAndLoadFlow,
} from '@runflow/workspace'
import { z } from 'zod'

export interface ConfigAndRegistry {
  config: RunflowConfig | null
  configDir: string
  registry: StepRegistry
}

export type GetConfigAndRegistry = () => Promise<ConfigAndRegistry>
export type GetDiscoverCatalog = () => Promise<DiscoverEntry[]>

const listFlowsInputSchema = {
  limit: z.number().int().min(1).max(MAX_DISCOVER_LIMIT).optional().describe(`Max number of flows to return (max ${MAX_DISCOVER_LIMIT}). Default: ${DEFAULT_DISCOVER_LIMIT}`),
  offset: z.number().int().min(0).optional().describe('Number of flows to skip (for pagination). Default: 0.'),
  keyword: z.string().optional().describe('Filter by file name, flow name, or description containing this string (case-insensitive). Omit to list all.'),
}

const runFlowInputSchema = {
  flowId: z.string().describe('Flow identifier: path to flow YAML (absolute or relative to flowsDir/cwd), or handlerKey:operationKey (e.g. simple:get-users) when config handlers has OpenAPI entries'),
  params: z.record(z.unknown()).optional().describe('Optional initial parameters for the flow'),
}

const discoverFlowDetailInputSchema = {
  flowId: z.string().describe('Flow identifier to look up in the catalog (file path or handlerKey:operationKey).'),
}

const MARKER_STEP_ID_RE = /^\w+\.iteration_\d+$/

function formatStepIdDisplay(stepId: string): string {
  const m = stepId.match(/^(\w+)\.iteration_(\d+)$/)
  if (!m)
    return stepId
  const [, parent, num] = m
  return `${parent} [iteration ${num}]`
}

/** Format run result for MCP tool text content. Exported for tests. */
export function formatRunResult(result: Awaited<ReturnType<typeof run>>, flowName?: string): string {
  const status = result.success ? '**Success**' : '**Failed**'
  const name = flowName ?? 'Flow'
  const headline = `${status} — Flow "${name}" (${result.steps.length} step(s)).`
  const stepLines = result.steps.map((s) => {
    const displayId = formatStepIdDisplay(s.stepId)
    const isMarker = MARKER_STEP_ID_RE.test(s.stepId)
    if (isMarker)
      return `  ${displayId}`
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

/** discover_flow_list tool handler: list flows as compact table (flowId, name) with pagination hint. */
export async function discoverFlowListTool(
  args: { limit?: number, offset?: number, keyword?: string },
  getDiscoverCatalog: GetDiscoverCatalog,
): Promise<CallToolResult> {
  const { limit = DEFAULT_DISCOVER_LIMIT, offset = 0, keyword } = args
  const catalog = await getDiscoverCatalog()
  const keywordLower = keyword?.toLowerCase()
  const filtered = keywordLower == null
    ? catalog
    : catalog.filter(e =>
        e.flowId.toLowerCase().includes(keywordLower)
        || (e.name ?? '').toLowerCase().includes(keywordLower)
        || (e.description ?? '').toLowerCase().includes(keywordLower),
      )
  const text = formatListAsMarkdown(filtered, limit, offset)
  return { content: [{ type: 'text' as const, text }] }
}

/** Execute tool handler: run a flow by flowId. */
export async function executeTool(
  args: { flowId: string, params?: Record<string, unknown> },
  getConfig: GetConfigAndRegistry,
): Promise<CallToolResult> {
  const { flowId, params } = args
  const cwd = process.cwd()
  const { config, configDir, registry } = await getConfig()
  let loaded: Awaited<ReturnType<typeof resolveAndLoadFlow>>
  try {
    loaded = await resolveAndLoadFlow(flowId, config, configDir, cwd)
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text' as const, text: message }], isError: true }
  }
  const resolveFlow = createResolveFlow(config, configDir, cwd)
  const flowMap = await buildFlowMapForRun(loaded.flow, resolveFlow)
  const effectiveParamsDeclaration = mergeParamDeclarations(config?.params, loaded.flow.params)
  const toolParams: Record<string, unknown> = { ...(params ?? {}) }
  try {
    const result = await run(loaded.flow, {
      registry,
      params: Object.keys(toolParams).length ? toolParams : undefined,
      effectiveParamsDeclaration: effectiveParamsDeclaration.length > 0 ? effectiveParamsDeclaration : undefined,
      flowMap: Object.keys(flowMap).length > 0 ? flowMap : undefined,
    })
    const text = formatRunResult(result, loaded.flow.name)
    return { content: [{ type: 'text' as const, text }], isError: !result.success }
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { content: [{ type: 'text' as const, text: `Run error: ${message}` }], isError: true }
  }
}

/** discover_flow_detail tool handler: return one flow's name, description, params by flowId. */
export async function discoverFlowDetailTool(
  args: { flowId: string },
  getDiscoverCatalog: GetDiscoverCatalog,
): Promise<CallToolResult> {
  const { flowId } = args
  const catalog = await getDiscoverCatalog()
  const entry = getDiscoverEntry(catalog, flowId)
  if (!entry) {
    return {
      content: [{ type: 'text' as const, text: `Flow not found: ${flowId}` }],
      isError: true,
    }
  }
  const text = formatDetailAsMarkdown(entry)
  return { content: [{ type: 'text' as const, text }] }
}

export function registerTools(
  server: McpServer,
  getConfig: GetConfigAndRegistry,
  getDiscoverCatalog: GetDiscoverCatalog,
): void {
  server.registerTool(
    'executor_flow',
    {
      description: 'Run a flow by flowId (file path or handlerKey:operationKey from config handlers). Returns success summary or error message.',
      inputSchema: runFlowInputSchema,
    },
    args => executeTool(args, getConfig),
  )
  server.registerTool(
    'discover_flow_list',
    {
      description: 'List flows from config (flowsDir YAML + OpenAPI) as compact table: flowId, name, type (file|openapi). Use keyword, limit, offset; pagination hint when more results exist.',
      inputSchema: listFlowsInputSchema,
    },
    args => discoverFlowListTool(args, getDiscoverCatalog),
  )
  server.registerTool(
    'discover_flow_detail',
    {
      description: 'Get one flow\'s full detail (name, description, params) by flowId from the catalog.',
      inputSchema: discoverFlowDetailInputSchema,
    },
    args => discoverFlowDetailTool(args, getDiscoverCatalog),
  )
}
