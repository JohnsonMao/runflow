// @env node
import type { IStepHandler, StepRegistry } from '@runflow/core'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { openApiToFlows } from '@runflow/convention-openapi'
import { createDefaultRegistry, loadFromFile, registerStepHandler, run } from '@runflow/core'
import { createCommand } from 'commander'

const CONFIG_NAMES = ['runflow.config.mjs', 'runflow.config.js']

interface RunflowConfig {
  handlers?: Record<string, string>
}

const program = createCommand()

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

async function loadConfig(configPath: string): Promise<RunflowConfig | null> {
  if (!existsSync(configPath) || !statSync(configPath).isFile())
    return null
  try {
    const mod = await import(pathToFileURL(configPath).href) as { default?: RunflowConfig }
    return mod.default ?? null
  }
  catch {
    return null
  }
}

function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_NAMES) {
    const p = path.join(cwd, name)
    if (existsSync(p) && statSync(p).isFile())
      return p
  }
  return null
}

async function buildRegistryFromConfig(configPath: string): Promise<StepRegistry> {
  const config = await loadConfig(configPath)
  const registry = createDefaultRegistry()
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
      registerStepHandler(registry, type, handler)
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
  .command('run [file]')
  .description('Execute a flow from a YAML file, or from an OpenAPI spec with --from-openapi and --operation')
  .option('--dry-run', 'Parse and validate only, do not execute steps')
  .option('--verbose', 'Print per-step output')
  .option('--from-openapi <path>', 'Load flow from OpenAPI spec; requires --operation')
  .option('--operation <key>', 'Operation key e.g. get-users (required with --from-openapi)')
  .option('--param <key=value>', 'Pass a parameter (repeatable)', (v: string, acc: string[] = []) => (acc ?? []).concat([v]), [] as string[])
  .option('--params-file <path>', 'Load params from a JSON file', undefined)
  .option('-f <path>', 'Short for --params-file', undefined)
  .option('--config <path>', 'Path to runflow.config.mjs (default: cwd/runflow.config.mjs)', undefined)
  .option('--registry <path>', 'Path to a JS/ESM module that exports default (StepRegistry); merged after config handlers', undefined)
  .action(async (file: string | undefined, options: { dryRun?: boolean, verbose?: boolean, fromOpenapi?: string, operation?: string, param?: string[], paramsFile?: string, f?: string, config?: string, registry?: string }) => {
    let flow: Awaited<ReturnType<typeof loadFromFile>>
    let flowFilePath: string | undefined
    if (options.fromOpenapi) {
      if (!options.operation) {
        console.error('Error: --operation is required when using --from-openapi (e.g. --operation get-users)')
        process.exit(1)
      }
      const specPath = path.resolve(process.cwd(), options.fromOpenapi)
      if (!existsSync(specPath) || !statSync(specPath).isFile()) {
        console.error(`Error: OpenAPI spec not found: ${specPath}`)
        process.exit(1)
      }
      const flows = await openApiToFlows(specPath, { output: 'memory' })
      const selected = flows.get(options.operation)
      if (!selected) {
        const keys = [...flows.keys()].slice(0, 10).join(', ')
        console.error(`Error: Operation "${options.operation}" not found. Available (sample): ${keys}${flows.size > 10 ? '...' : ''}`)
        process.exit(1)
      }
      flow = selected
      flowFilePath = specPath
    }
    else {
      if (!file) {
        console.error('Error: Either <file> or --from-openapi is required.')
        process.exit(1)
      }
      if (!existsSync(file) || !statSync(file).isFile()) {
        console.error(`Error: File not found or not a regular file: ${file}`)
        process.exit(1)
      }
      flow = loadFromFile(file)
      flowFilePath = path.resolve(file)
    }
    if (!flow) {
      console.error('Error: Invalid or unreadable flow file.')
      process.exit(1)
    }
    const paramsPath = options.paramsFile ?? options.f
    let params: Record<string, unknown> = paramsPath ? loadParamsFile(paramsPath) : {}
    if (options.param?.length) {
      const cliParams = parseParamPairs(options.param)
      params = { ...params, ...cliParams }
    }
    const cwd = process.cwd()
    let registry: StepRegistry
    const configPath = options.config
      ? path.resolve(cwd, options.config)
      : findConfigFile(cwd)
    if (configPath) {
      registry = await buildRegistryFromConfig(configPath)
    }
    else {
      registry = createDefaultRegistry()
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
            if (handler && typeof (handler as IStepHandler).run === 'function')
              registerStepHandler(registry, type, handler as IStepHandler)
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
  .command('params <file>')
  .description('List parameters declared by a flow (name, type, required, enum, description)')
  .action((file: string) => {
    if (!existsSync(file) || !statSync(file).isFile()) {
      console.error(`Error: File not found or not a regular file: ${file}`)
      process.exit(1)
    }
    const flow = loadFromFile(file)
    if (!flow) {
      console.error('Error: Invalid or unreadable flow file.')
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

program.parse()
