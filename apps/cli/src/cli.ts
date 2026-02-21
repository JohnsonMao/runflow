// @env node
import type { IStepHandler, StepRegistry } from '@runflow/core'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { flowGraphToJson, flowGraphToMermaid, run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
import {
  buildDiscoverCatalog,
  createResolveFlow,
  DEFAULT_DISCOVER_LIMIT,
  findConfigFile,
  flowDefinitionToGraphForVisualization,
  formatDetailAsMarkdown,
  formatListAsMarkdown,
  getDiscoverEntry,
  isOpenApiHandlerEntry,
  loadConfig,
  MAX_DISCOVER_LIMIT,
  mergeParamDeclarations,
  resolveAndLoadFlow,
} from '@runflow/workspace'
import { createCommand } from 'commander'

export const program = createCommand()

program
  .name('flow')
  .description('Run YAML-defined flows')
  .version('0.0.0')

function parseParamPairs(pairs: string[]): Record<string, string> {
  const params: Record<string, string> = {}
  for (const pair of pairs) {
    const eq = pair.indexOf('=')
    if (eq === -1)
      continue
    const key = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    params[key] = value
  }
  return params
}

function loadParamsFile(filePath: string): Record<string, unknown> {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      console.error(`Error: params file must be a JSON object: ${filePath}`)
      process.exit(1)
    }
    return data
  }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`Error: Failed to read params file: ${msg}`)
    process.exit(1)
  }
}

async function buildRegistryFromConfig(configPath: string): Promise<StepRegistry> {
  const config = await loadConfig(configPath)
  const registry = createBuiltinRegistry()
  if (!config?.handlers || typeof config.handlers !== 'object')
    return registry
  const configDir = path.dirname(configPath)
  const httpHandler = registry.http
  for (const [type, value] of Object.entries(config.handlers)) {
    if (typeof value === 'string') {
      const resolved = path.resolve(configDir, value)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        console.error(`Error: Handler module not found for type "${type}": ${resolved}`)
        process.exit(1)
      }
      try {
        const mod = await import(pathToFileURL(resolved).href) as { default?: IStepHandler }
        const handler = mod.default
        if (!handler || typeof handler.run !== 'function') {
          console.error(`Error: Handler module for "${type}" must export default (IStepHandler).`)
          process.exit(1)
        }
        registry[type] = handler
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Error: Failed to load handler "${type}": ${msg}`)
        process.exit(1)
      }
      continue
    }
    if (!isOpenApiHandlerEntry(value))
      continue
    if (value.handler) {
      const resolved = path.resolve(configDir, value.handler)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        console.error(`Error: OpenAPI handler module not found for type "${type}": ${resolved}`)
        process.exit(1)
      }
      try {
        const mod = await import(pathToFileURL(resolved).href) as { default?: IStepHandler }
        const handler = mod.default
        if (!handler || typeof handler.run !== 'function') {
          console.error(`Error: Handler module for "${type}" must export default (IStepHandler).`)
          process.exit(1)
        }
        registry[type] = handler
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Error: Failed to load handler "${type}": ${msg}`)
        process.exit(1)
      }
    }
    else {
      registry[type] = httpHandler
    }
  }
  return registry
}

interface RunCommandOptions {
  dryRun?: boolean
  verbose?: boolean
  param?: string[]
  paramsFile?: string
  f?: string
  config?: string
}

async function handleRunCommand(flowId: string, options: RunCommandOptions): Promise<void> {
  const cwd = process.cwd()
  const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
  const config = configPath ? await loadConfig(configPath) : null
  const configDir = configPath ? path.dirname(configPath) : cwd

  let flow: Awaited<ReturnType<typeof resolveAndLoadFlow>>
  try {
    flow = await resolveAndLoadFlow(flowId, config, configDir, cwd)
  }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`Error: ${msg}`)
    process.exit(1)
  }

  const effectiveParamsDeclaration = mergeParamDeclarations(config?.params, flow.flow.params)
  const paramsPath = options.paramsFile ?? options.f
  let params: Record<string, unknown> = {}
  if (paramsPath)
    params = { ...params, ...loadParamsFile(paramsPath) }
  if (options.param?.length) {
    const cliParams = parseParamPairs(options.param)
    params = { ...params, ...cliParams }
  }

  const registry = configPath ? await buildRegistryFromConfig(configPath) : createBuiltinRegistry()
  const resolveFlow = createResolveFlow(config, configDir, cwd)
  const result = await run(flow.flow, {
    dryRun: options.dryRun,
    params: Object.keys(params).length ? params : undefined,
    effectiveParamsDeclaration: effectiveParamsDeclaration.length > 0 ? effectiveParamsDeclaration : undefined,
    registry,
    resolveFlow,
  })

  if (options.verbose) {
    for (const step of result.steps) {
      if (step.log)
        process.stdout.write(`${step.log}\n`)
      if (step.outputs && Object.keys(step.outputs).length > 0)
        process.stdout.write(`${JSON.stringify(step.outputs)}\n`)
      if (step.error)
        console.error(`Step ${step.stepId}: ${step.error}`)
    }
  }

  if (!result.success) {
    if (result.error)
      console.error(`Error: ${result.error}`)
    console.error(`Flow "${result.flowName}" failed.`)
    process.exit(1)
  }
}

program
  .command('run [flowId]')
  .description('Execute a flow by flowId: file path (relative to flowsDir or cwd) or handlerKey:operationKey (e.g. simple:get-users) from config handlers')
  .option('--dry-run', 'Parse and validate only, do not execute steps')
  .option('--verbose', 'Print per-step output')
  .option('--param <key=value>', 'Pass a parameter (repeatable)', (v: string, acc: string[] = []) => (acc ?? []).concat([v]), [] as string[])
  .option('--params-file <path>', 'Load params from a JSON file', undefined)
  .option('-f <path>', 'Short for --params-file', undefined)
  .option('--config <path>', 'Path to runflow.config.mjs (default: cwd/runflow.config.mjs)', undefined)
  .action(async (flowId: string | undefined, options: RunCommandOptions) => {
    if (!flowId) {
      console.error('Error: flowId is required (file path or handlerKey:operationKey e.g. simple:get-users).')
      process.exit(1)
    }
    await handleRunCommand(flowId, options)
  })

program
  .command('list')
  .description('List flows (file flows under flowsDir/cwd + OpenAPI flows from config), same as MCP discover_flow_list')
  .option('--limit <n>', 'Max number of flows to return', (v: string) => Number.parseInt(v, 10), DEFAULT_DISCOVER_LIMIT)
  .option('--offset <n>', 'Number of flows to skip (pagination)', (v: string) => Number.parseInt(v, 10), 0)
  .option('--keyword <s>', 'Filter by flowId, name, or description (case-insensitive)', undefined)
  .option('--config <path>', 'Path to runflow.config.mjs', undefined)
  .option('--json', 'Output raw JSON (entries + total) for programmatic use', false)
  .action(async (options: { limit?: number, offset?: number, keyword?: string, config?: string, json?: boolean }) => {
    const cwd = process.cwd()
    const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
    const config = configPath ? await loadConfig(configPath) : null
    const configDir = configPath ? path.dirname(configPath) : cwd
    const catalog = await buildDiscoverCatalog(config, configDir, cwd)
    const keywordLower = options.keyword?.toLowerCase()
    const filtered = keywordLower == null
      ? catalog
      : catalog.filter(e =>
          e.flowId.toLowerCase().includes(keywordLower)
          || (e.name ?? '').toLowerCase().includes(keywordLower)
          || (e.description ?? '').toLowerCase().includes(keywordLower),
        )
    const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_DISCOVER_LIMIT), MAX_DISCOVER_LIMIT)
    const offset = Math.max(0, options.offset ?? 0)
    if (options.json) {
      const slice = filtered.slice(offset, offset + limit)
      console.log(JSON.stringify({ total: filtered.length, entries: slice }, null, 2))
      return
    }
    console.log(formatListAsMarkdown(filtered, limit, offset))
  })

program
  .command('detail <flowId>')
  .description('Show one flow\'s detail (name, description, params) by flowId, same as MCP discover_flow_detail')
  .option('--config <path>', 'Path to runflow.config.mjs', undefined)
  .option('--json', 'Output raw JSON (entry) for programmatic use', false)
  .action(async (flowId: string, options: { config?: string, json?: boolean }) => {
    const cwd = process.cwd()
    const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
    const config = configPath ? await loadConfig(configPath) : null
    const configDir = configPath ? path.dirname(configPath) : cwd
    const catalog = await buildDiscoverCatalog(config, configDir, cwd)
    const entry = getDiscoverEntry(catalog, flowId)
    if (!entry) {
      console.error(`Error: Flow not found: ${flowId}`)
      process.exit(1)
    }
    if (options.json) {
      console.log(JSON.stringify(entry, null, 2))
      return
    }
    console.log(formatDetailAsMarkdown(entry))
  })

type ViewOutputFormat = 'mermaid' | 'json'

program
  .command('view <flowId>')
  .description('Output flow graph as Mermaid or JSON (flow-graph-format)')
  .option('--output <format>', 'Output format: mermaid (default) or json', 'mermaid')
  .option('--config <path>', 'Path to runflow.config.mjs', undefined)
  .action(async (flowId: string, options: { output?: string, config?: string }) => {
    const cwd = process.cwd()
    const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
    const config = configPath ? await loadConfig(configPath) : null
    const configDir = configPath ? path.dirname(configPath) : cwd
    let loaded: Awaited<ReturnType<typeof resolveAndLoadFlow>>
    try {
      loaded = await resolveAndLoadFlow(flowId, config, configDir, cwd)
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Error: ${msg}`)
      process.exit(1)
    }
    const graph = flowDefinitionToGraphForVisualization(loaded.flow)
    const format = (options.output ?? 'mermaid').toLowerCase() as ViewOutputFormat
    if (format === 'json') {
      console.log(JSON.stringify(flowGraphToJson(graph), null, 2))
    }
    else {
      console.log(flowGraphToMermaid(graph))
    }
  })

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  program.parse()
