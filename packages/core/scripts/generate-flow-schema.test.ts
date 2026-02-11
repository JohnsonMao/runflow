import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { generateFlowSchema } from './generate-flow-schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const schemaPath = join(rootDir, 'dist', 'flow.schema.json')

describe('generate-flow-schema script', () => {
  it('produces dist/flow.schema.json with $schema and definitions', () => {
    generateFlowSchema()
    expect(existsSync(schemaPath)).toBe(true)
    const content = readFileSync(schemaPath, 'utf-8')
    const schema = JSON.parse(content) as Record<string, unknown>
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.$id).toBe('https://runflow.dev/flow.schema.json')
    expect(schema.definitions).toBeDefined()
    expect(typeof schema.definitions).toBe('object')
    const defs = schema.definitions as Record<string, unknown>
    expect(defs.FlowDefinition).toBeDefined()
    expect(defs.FlowStep).toBeDefined()
  })
})
