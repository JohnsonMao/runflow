/**
 * Generate flow.schema.json from TypeScript types (types.ts) via ts-json-schema-generator.
 * See https://www.npmjs.com/package/ts-json-schema-generator
 * Single source of truth: FlowDefinition and related interfaces in src/types.ts.
 * Run: pnpm --filter @runflow/core generate:schema
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from 'ts-json-schema-generator'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const outPath = join(distDir, 'flow.schema.json')
const typesPath = join(rootDir, 'src', 'types.ts')
const tsconfigPath = join(rootDir, 'tsconfig.json')

const config = {
  path: typesPath,
  tsconfig: tsconfigPath,
  type: 'FlowDefinition',
  expose: 'export' as const,
  jsDoc: 'extended' as const,
}

const schema = createGenerator(config).createSchema(config.type) as Record<string, unknown>

const defs = schema.definitions as Record<string, unknown> | undefined
const flowStep = defs?.FlowStep as Record<string, unknown> | undefined
if (flowStep)
  flowStep.additionalProperties = true

const withMeta = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://runflow.dev/flow.schema.json',
  title: 'Runflow Flow',
  description: 'Flow definition (name, optional params, steps with id and type)',
  ...schema,
}

mkdirSync(distDir, { recursive: true })
writeFileSync(outPath, `${JSON.stringify(withMeta, null, 2)}\n`, 'utf8')
console.log('Wrote', outPath)
