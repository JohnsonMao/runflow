import type { DiscoverEntry } from '@runflow/workspace'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceContext } from './workspace-api'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { handleGetDetail, handleGetGraph, handleGetList, handleGetStatus, handleGetTree, handlePostRun, sendJson } from './workspace-handlers'

vi.mock('@runflow/workspace', () => ({
  buildDiscoverCatalog: vi.fn(async () => [{ flowId: 'f1', name: 'Flow 1' }]),
  buildTreeFromCatalog: vi.fn(() => [{ id: 't1', label: 'Tree 1' }]),
  buildTagTree: vi.fn(() => [{ id: 'tag1', label: 'Tag 1' }]),
  getDiscoverEntry: vi.fn((catalog: DiscoverEntry[], flowId: string) => catalog.find(e => e.flowId === flowId)),
  resolveAndLoadFlow: vi.fn(async flowId => ({
    flow: { id: flowId, name: 'Flow 1', steps: [{ id: 's1', type: 't1', name: 'Step 1' }] },
  })),
  flowDefinitionToGraphForVisualization: vi.fn(() => ({ nodes: [{ id: 's1' }], edges: [] })),
  mergeParamDeclarations: vi.fn(() => []),
  saveRunResult: vi.fn(),
  formatRunResult: vi.fn(() => 'Mock Result'),
}))

vi.mock('./execution', () => ({
  reloadAndExecuteFlow: vi.fn(async () => ({
    loaded: { flow: { name: 'Flow 1' } },
    result: { success: true },
  })),
}))

describe('workspaceHandlers', () => {
  describe('handleGetStatus', () => {
    it('should send workspace status', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        cwd: '/test',
        configPath: '/test/runflow.config.json',
        config: {} as any,
      }

      const req = {} as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }

      await handleGetStatus(req, res, mockCtx as WorkspaceContext)

      expect(res.statusCode).toBe(200)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body).toEqual({
        workspaceRoot: '/test',
        configPath: '/test/runflow.config.json',
        configured: true,
      })
    })

    it('should return configured: false if no configPath', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        cwd: '/test',
        configPath: null,
        config: null,
      }

      const req = {} as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }

      await handleGetStatus(req, res, mockCtx as WorkspaceContext)

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body.configured).toBe(false)
    })
  })

  describe('handleGetList', () => {
    it('should return catalog list', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        cwd: '/test',
        config: {} as any,
        configDir: '/test',
      }
      const req = {} as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }

      await handleGetList(req, res, mockCtx as WorkspaceContext)

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0].flowId).toBe('f1')
    })
  })

  describe('handleGetTree', () => {
    it('should return workspace tree', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        cwd: '/test',
        config: {} as any,
        configDir: '/test',
        configPath: '/test/c.json',
      }
      const req = {} as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }

      await handleGetTree(req, res, mockCtx as WorkspaceContext)

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body.tree).toHaveLength(1)
      expect(body.tagTree).toHaveLength(1)
      expect(body.workspaceRoot).toBe('/test')
    })
  })

  describe('handleGetGraph', () => {
    it('should return flow graph data', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        cwd: '/test',
        config: {} as any,
        configDir: '/test',
      }
      const req = {} as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }
      const query = new URLSearchParams('flowId=f1')

      await handleGetGraph(req, res, mockCtx as WorkspaceContext, query)

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body.nodes).toHaveLength(1)
      expect(body.flowId).toBe('f1')
    })

    it('should return 400 if flowId is missing', async () => {
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }
      const query = new URLSearchParams('')

      await handleGetGraph({} as any, res, {} as any, query)

      expect(res.statusCode).toBe(400)
    })
  })

  describe('handleGetDetail', () => {
    it('should return flow entry detail', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        config: {} as any,
        configDir: '/test',
        cwd: '/test',
      }
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }
      const query = new URLSearchParams('flowId=f1')

      await handleGetDetail({} as any, res, mockCtx as WorkspaceContext, query)

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body.flowId).toBe('f1')
    })

    it('should return 404 if flow entry is not found', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        config: {} as any,
        configDir: '/test',
        cwd: '/test',
      }
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }
      const query = new URLSearchParams('flowId=notfound')

      await handleGetDetail({} as any, res, mockCtx as WorkspaceContext, query)

      expect(res.statusCode).toBe(404)
    })
  })

  describe('handlePostRun', () => {
    it('should execute flow and return result', async () => {
      const mockCtx: Partial<WorkspaceContext> = {
        config: {} as any,
        configDir: '/test',
      }
      const req = {
        async* [Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({ flowId: 'f1', params: { a: 1 } }))
        },
      } as unknown as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }

      await handlePostRun(req, res, mockCtx as WorkspaceContext)

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.end.mock.calls[0][0])
      expect(body.success).toBe(true)
      expect(body.text).toBe('Mock Result')
    })

    it('should return 400 if flowId is missing in body', async () => {
      const req = {
        async* [Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({}))
        },
      } as unknown as IncomingMessage
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse & { statusCode: number, end: { mock: { calls: any[][] } } }

      await handlePostRun(req, res, {} as any)

      expect(res.statusCode).toBe(400)
    })
  })

  describe('sendJson', () => {
    it('should set headers and end response', () => {
      const res = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse

      sendJson(res, 201, { foo: 'bar' })

      expect(res.statusCode).toBe(201)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }))
    })
  })
})
