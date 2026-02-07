// @env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { loadFromFile, run } from '@runflow/core'
import { createCommand } from 'commander'

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

program
  .command('run <file>')
  .description('Execute a flow from a YAML file')
  .option('--dry-run', 'Parse and validate only, do not execute steps')
  .option('--verbose', 'Print per-step output')
  .option('--param <key=value>', 'Pass a parameter (repeatable)', (v: string, acc: string[] = []) => (acc ?? []).concat([v]), [] as string[])
  .option('--params-file <path>', 'Load params from a JSON file', undefined)
  .option('-f <path>', 'Short for --params-file', undefined)
  .action((file: string, options: { dryRun?: boolean, verbose?: boolean, param?: string[], paramsFile?: string, f?: string }) => {
    if (!existsSync(file) || !statSync(file).isFile()) {
      console.error(`Error: File not found or not a regular file: ${file}`)
      process.exit(1)
    }
    const flow = loadFromFile(file)
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
    const flowFilePath = path.resolve(file)
    const result = run(flow, { dryRun: options.dryRun, params: Object.keys(params).length ? params : undefined, flowFilePath })
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
