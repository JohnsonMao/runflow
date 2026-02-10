import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadOpenApiDocument, openApiToFlows } from './index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures')

describe('openApiToFlows', () => {
  it('produces one flow per path+method with correct name, params, and http step', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, { output: 'memory' })

    expect(result.size).toBeGreaterThanOrEqual(2)

    const getUsersFlow = result.get('get-users')
    expect(getUsersFlow).toBeDefined()
    expect(getUsersFlow!.name).toBeDefined()
    expect(Array.isArray(getUsersFlow!.steps)).toBe(true)
    const httpStep = getUsersFlow!.steps.find(s => s.type === 'http')
    expect(httpStep).toBeDefined()
    expect((httpStep as { method?: string }).method?.toLowerCase()).toBe('get')
    expect((httpStep as { url?: string }).url).toContain('/users')

    const params = getUsersFlow!.params ?? []
    const limitParam = params.find((p: { name: string }) => p.name === 'limit')
    expect(limitParam).toBeDefined()
  })

  it('in-memory mode returns flows in map without writing to filesystem', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, { output: 'memory' })
    expect(result.size).toBeGreaterThanOrEqual(2)
    for (const flow of result.values()) {
      expect(flow.name).toBeDefined()
      expect(Array.isArray(flow.steps)).toBe(true)
    }
  })

  it('with hooks inserts before/after steps and sets dependsOn', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, {
      output: 'memory',
      hooks: {
        'get-users': {
          before: [{ type: 'set', set: {} }],
          after: [{ type: 'set', set: {} }],
        },
      },
    })

    const flow = result.get('get-users')
    expect(flow).toBeDefined()
    expect(flow!.steps.length).toBe(3)
    const [first, second, third] = flow!.steps
    expect(first.type).toBe('set')
    expect(second.type).toBe('http')
    expect(third.type).toBe('set')
    expect(second.dependsOn).toContain(first.id)
    expect(third.dependsOn).toContain(second.id)
  })

  it('with hooks array and regex applies to matching operations', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, {
      output: 'memory',
      hooks: [
        { pattern: /^get-/, hooks: { before: [{ type: 'set', set: {} }] } },
      ],
    })
    const getUsers = result.get('get-users')
    const getUser = result.get('get-users-id')
    expect(getUsers).toBeDefined()
    expect(getUser).toBeDefined()
    expect(getUsers!.steps.length).toBe(2)
    expect(getUser!.steps.length).toBe(2)
    expect(getUsers!.steps[0].type).toBe('set')
    expect(getUser!.steps[0].type).toBe('set')
  })
})

describe('loadOpenApiDocument', () => {
  it('loads from file path (YAML)', async () => {
    const doc = await loadOpenApiDocument(join(FIXTURES, 'minimal-openapi.yaml'))
    expect(doc.openapi).toBe('3.0.0')
    expect(doc.paths).toBeDefined()
    expect(doc.paths!['/users']).toBeDefined()
  })

  it('accepts in-memory object', async () => {
    const obj = { openapi: '3.0.0', paths: { '/x': { get: {} } } }
    const doc = await loadOpenApiDocument(obj)
    expect(doc).toBe(obj)
    expect(doc.paths!['/x'].get).toBeDefined()
  })
})
