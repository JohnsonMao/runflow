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

  it('default paramExpose includes path and query, excludes header and cookie', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, { output: 'memory' })
    const getUsersFlow = result.get('get-users')
    expect(getUsersFlow?.params?.some((p: { name: string }) => p.name === 'limit')).toBe(true)
    const getUsersIdFlow = result.get('get-users-id')
    expect(getUsersIdFlow?.params?.some((p: { name: string }) => p.name === 'id')).toBe(true)
  })

  it('custom paramExpose filters out query params when query is false', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, {
      output: 'memory',
      paramExpose: { path: true, query: false, body: true, header: false, cookie: false },
    })
    const getUsersFlow = result.get('get-users')
    expect(getUsersFlow?.params?.some((p: { name: string }) => p.name === 'limit')).toBe(false)
    const getUsersIdFlow = result.get('get-users-id')
    expect(getUsersIdFlow?.params?.some((p: { name: string }) => p.name === 'id')).toBe(true)
  })

  it('with override generates one step of override type with url and method', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, { output: 'memory', override: 'myHandler' })
    const flow = result.get('get-users')
    expect(flow?.steps.length).toBe(1)
    const step = flow!.steps[0]
    expect(step.type).toBe('myHandler')
    expect((step as { url?: string }).url).toBeDefined()
    expect((step as { method?: string }).method?.toLowerCase()).toBe('get')
  })

  it('without override step remains type http', async () => {
    const specPath = join(FIXTURES, 'minimal-openapi.yaml')
    const result = await openApiToFlows(specPath, { output: 'memory' })
    const flow = result.get('get-users')
    const httpStep = flow?.steps.find(s => s.type === 'http')
    expect(httpStep).toBeDefined()
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
