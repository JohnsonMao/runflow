import type { DiscoverEntry } from '@runflow/workspace'
import { buildTreeFromCatalog } from '@runflow/workspace'
import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceApiMiddleware } from './workspace-api'

describe('buildTreeFromCatalog', () => {
  it('builds file nodes for path-like flowIds', () => {
    const catalog: DiscoverEntry[] = [
      { flowId: 'flows/hello.yaml', name: 'Hello', path: 'flows/hello.yaml' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('folder')
    expect(tree[0].label).toBe('flows')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children![0].type).toBe('file')
    expect(tree[0].children![0].flowId).toBe('flows/hello.yaml')
    expect(tree[0].children![0].label).toBe('hello.yaml')
  })

  it('puts openapi-like flowId without colon as single file node', () => {
    const catalog: DiscoverEntry[] = [
      { flowId: 'pet-get', name: 'Get pet' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('file')
    expect(tree[0].flowId).toBe('pet-get')
    expect(tree[0].label).toBe('Get pet')
  })

  it('groups openapi flows by handler key when flowId is handlerKey:operationKey', () => {
    const catalog: DiscoverEntry[] = [
      { flowId: 'pet:get', name: 'Get', handlerKey: 'pet', originalFlowId: 'pet:get' },
      { flowId: 'pet:list', name: 'List', handlerKey: 'pet', originalFlowId: 'pet:list' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('openapi:pet')
    expect(tree[0].type).toBe('folder')
    expect(tree[0].children).toHaveLength(2)
  })
})

describe('createWorkspaceApiMiddleware', () => {
  it('should call next() for non-matching URLs', async () => {
    const middleware = createWorkspaceApiMiddleware()
    const req = { url: '/foo' } as any
    const res = {} as any
    const next = vi.fn()

    await middleware(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('should handle /api/workspace/status', async () => {
    const mockCtx = {
      cwd: '/test',
      configPath: '/test/config.yaml',
      configDir: '/test',
      config: {},
    }
    const middleware = createWorkspaceApiMiddleware(mockCtx as any)
    const req = { url: '/api/workspace/status' } as any
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as any
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.statusCode).toBe(200)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    const body = JSON.parse(res.end.mock.calls[0][0])
    expect(body.workspaceRoot).toBe('/test')
    expect(body.configured).toBe(true)
  })
})
