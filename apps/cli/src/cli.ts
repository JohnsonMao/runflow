// @env node
import { existsSync, statSync } from 'node:fs'
import { loadFromFile, run } from '@runflow/core'
import { createCommand } from 'commander'

const program = createCommand()

program
  .name('flow')
  .description('Run YAML-defined flows')
  .version('0.0.0')

program
  .command('run <file>')
  .description('Execute a flow from a YAML file')
  .option('--dry-run', 'Parse and validate only, do not execute steps')
  .option('--verbose', 'Print per-step output')
  .action((file: string, options: { dryRun?: boolean, verbose?: boolean }) => {
    if (!existsSync(file) || !statSync(file).isFile()) {
      console.error(`Error: File not found or not a regular file: ${file}`)
      process.exit(1)
    }
    const flow = loadFromFile(file)
    if (!flow) {
      console.error('Error: Invalid or unreadable flow file.')
      process.exit(1)
    }
    const result = run(flow, { dryRun: options.dryRun })
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
      console.error(`Flow "${result.flowName}" failed.`)
      process.exit(1)
    }
  })

program.parse()
