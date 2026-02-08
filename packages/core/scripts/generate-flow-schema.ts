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

let schema: Record<string, unknown>
try {
  schema = createGenerator(config).createSchema(config.type) as Record<string, unknown>
  const defs = schema.definitions as Record<string, unknown> | undefined
  const flowStep = defs?.FlowStep as Record<string, unknown> | undefined
  if (flowStep)
    flowStep.additionalProperties = true
}
catch {
  // Fallback when ts-json-schema-generator fails (e.g. fs.globSync)
  schema = {
    definitions: {
      FlowDefinition: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, params: { type: 'array' }, steps: { type: 'array' } }, required: ['name', 'steps'], additionalProperties: false },
      FlowStep: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } } }, required: ['id', 'type'], additionalProperties: true },
      ParamDeclaration: { type: 'object', properties: { name: { type: 'string' }, type: {} }, required: ['name', 'type'], additionalProperties: false },
      ParamType: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array'] },
    },
    $ref: '#/definitions/FlowDefinition',
  }
}

const withMeta = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://runflow.dev/flow.schema.json',
  title: 'Runflow Flow',
  description: 'Flow definition (name, optional params, steps with id, type, optional dependsOn)',
  ...schema,
}

mkdirSync(distDir, { recursive: true })
writeFileSync(outPath, `${JSON.stringify(withMeta, null, 2)}\n`, 'utf8')
console.log('Wrote', outPath)
