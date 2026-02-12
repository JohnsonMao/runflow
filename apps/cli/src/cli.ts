// @env node
import type { IStepHandler, StepRegistry } from '@runflow/core'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { findConfigFile, loadConfig, resolveFlowId } from '@runflow/config'
import { openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile, run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
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
  for (const [type, modulePath] of Object.entries(config.handlers)) {
    if (typeof modulePath !== 'string')
      continue
    const resolved = path.resolve(configDir, modulePath)
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
  }
  return registry
}

program
  .command('run [flowId]')
  .description('Execute a flow by flowId: file path (relative to flowsDir or cwd) or prefix-operation (e.g. my-api-get-users) from config openapi')
  .option('--dry-run', 'Parse and validate only, do not execute steps')
  .option('--verbose', 'Print per-step output')
  .option('--param <key=value>', 'Pass a parameter (repeatable)', (v: string, acc: string[] = []) => (acc ?? []).concat([v]), [] as string[])
  .option('--params-file <path>', 'Load params from a JSON file', undefined)
  .option('-f <path>', 'Short for --params-file', undefined)
  .option('--config <path>', 'Path to runflow.config.mjs (default: cwd/runflow.config.mjs)', undefined)
  .option('--registry <path>', 'Path to a JS/ESM module that exports default (StepRegistry); merged after config handlers', undefined)
  .action(async (flowId: string | undefined, options: { dryRun?: boolean, verbose?: boolean, param?: string[], paramsFile?: string, f?: string, config?: string, registry?: string }) => {
    const cwd = process.cwd()
    if (!flowId) {
      console.error('Error: flowId is required (file path or prefix-operation e.g. my-api-get-users).')
      process.exit(1)
    }
    const configPath = options.config
      ? path.resolve(cwd, options.config)
      : findConfigFile(cwd)
    const config = configPath ? await loadConfig(configPath) : null
    const configDir = configPath ? path.dirname(configPath) : cwd
    const resolved = resolveFlowId(flowId, config, configDir, cwd)
    let flow: Awaited<ReturnType<typeof loadFromFile>>
    let flowFilePath: string | undefined
    if (resolved.type === 'openapi') {
      if (!existsSync(resolved.specPath) || !statSync(resolved.specPath).isFile()) {
        console.error(`Error: OpenAPI spec not found: ${resolved.specPath}`)
        process.exit(1)
      }
      const flows = await openApiToFlows(resolved.specPath, { ...resolved.options, output: 'memory' })
      const selected = flows.get(resolved.operation)
      if (!selected) {
        const keys = [...flows.keys()].slice(0, 10).join(', ')
        console.error(`Error: Operation "${resolved.operation}" not found. Available (sample): ${keys}${flows.size > 10 ? '...' : ''}`)
        process.exit(1)
      }
      flow = selected
      flowFilePath = resolved.specPath
    }
    else {
      if (!existsSync(resolved.path) || !statSync(resolved.path).isFile()) {
        console.error(`Error: File not found or not a regular file: ${resolved.path}`)
        process.exit(1)
      }
      flow = loadFromFile(resolved.path)
      flowFilePath = resolved.path
    }
    if (!flow) {
      console.error('Error: Invalid or unreadable flow file.')
      process.exit(1)
    }
    const paramsPath = options.paramsFile ?? options.f
    let params: Record<string, unknown> = { ...(config?.params ?? {}) }
    if (paramsPath)
      params = { ...params, ...loadParamsFile(paramsPath) }
    if (options.param?.length) {
      const cliParams = parseParamPairs(options.param)
      params = { ...params, ...cliParams }
    }
    let registry: StepRegistry
    if (configPath) {
      registry = await buildRegistryFromConfig(configPath)
    }
    else {
      registry = createBuiltinRegistry()
    }
    if (options.registry) {
      const resolved = path.resolve(cwd, options.registry)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        console.error(`Error: Registry file not found: ${resolved}`)
        process.exit(1)
      }
      try {
        const mod = await import(pathToFileURL(resolved).href) as { default?: StepRegistry }
        const extra = mod.default
        if (extra && typeof extra === 'object') {
          for (const [type, handler] of Object.entries(extra)) {
            if (handler && typeof handler.run === 'function')
              registry[type] = handler
          }
        }
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Error: Failed to load registry: ${msg}`)
        process.exit(1)
      }
    }
    const result = await run(flow, {
      dryRun: options.dryRun,
      params: Object.keys(params).length ? params : undefined,
      flowFilePath,
      registry,
    })
    if (options.verbose) {
      for (const step of result.steps) {
        if (step.stdout)
          process.stdout.write(step.stdout)
        if (step.stderr)
          process.stderr.write(step.stderr)
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
  })

program
  .command('params <flowId>')
  .description('List parameters declared by a flow (flowId: file path or prefix-operation)')
  .option('--config <path>', 'Path to runflow.config.mjs', undefined)
  .action(async (flowId: string, options: { config?: string }) => {
    const cwd = process.cwd()
    const configPath = options.config
      ? path.resolve(cwd, options.config)
      : findConfigFile(cwd)
    const config = configPath ? await loadConfig(configPath) : null
    const configDir = configPath ? path.dirname(configPath) : cwd
    const resolved = resolveFlowId(flowId, config, configDir, cwd)
    let flow: Awaited<ReturnType<typeof loadFromFile>>
    if (resolved.type === 'openapi') {
      if (!existsSync(resolved.specPath) || !statSync(resolved.specPath).isFile()) {
        console.error(`Error: OpenAPI spec not found: ${resolved.specPath}`)
        process.exit(1)
      }
      const flows = await openApiToFlows(resolved.specPath, { ...resolved.options, output: 'memory' })
      flow = flows.get(resolved.operation) ?? null
    }
    else {
      if (!existsSync(resolved.path) || !statSync(resolved.path).isFile()) {
        console.error(`Error: File not found or not a regular file: ${resolved.path}`)
        process.exit(1)
      }
      flow = loadFromFile(resolved.path)
    }
    if (!flow) {
      console.error('Error: Invalid or unreadable flow.')
      process.exit(1)
    }
    if (!flow.params?.length) {
      console.log('No params declared.')
      return
    }
    for (const p of flow.params) {
      const parts = [
        `  ${p.name}:`,
        `    type: ${p.type}`,
        p.required === true ? '    required: true' : null,
        p.default !== undefined ? `    default: ${JSON.stringify(p.default)}` : null,
        p.enum?.length ? `    enum: [${p.enum.map(v => JSON.stringify(v)).join(', ')}]` : null,
        p.description ? `    description: ${p.description}` : null,
      ].filter(Boolean)
      console.log(parts.join('\n'))
    }
  })

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  program.parse()
