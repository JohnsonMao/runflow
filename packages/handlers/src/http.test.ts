import type { FlowStep, StepContext } from '@runflow/core'
import { stepResult } from '@runflow/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpHandler } from './http'

const noopRunSubFlow = async () => ({ results: [], newContext: {} })
const emptyContext: StepContext = { params: {}, runSubFlow: noopRunSubFlow, stepResult }

describe('http handler', () => {
  const handler = new HttpHandler()

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('validate', () => {
    it('returns true when step has url', () => {
      const step: FlowStep = { id: 'h1', type: 'http', url: 'https://example.com', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no url', () => {
      const step: FlowStep = { id: 'h1', type: 'http', dependsOn: [] }
      expect(handler.validate(step)).toBe('http step requires url (string)')
    })
  })

  describe('run', () => {
    it('returns success and parsed JSON body for 2xx response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"key":"value"}'),
      } as Response)
      const step: FlowStep = { id: 'fetch', type: 'http', url: 'https://example.com/json', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toBeDefined()
      const resp = result.outputs as { statusCode: number, body: unknown }
      expect(resp.statusCode).toBe(200)
      expect(resp.body).toEqual({ key: 'value' })
    })

    it('returns success and responseObject for 4xx (handler does not fail on 4xx)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 404,
        headers: new Headers(),
        text: () => Promise.resolve('Not Found'),
      } as Response)
      const step: FlowStep = { id: 'fetch', type: 'http', url: 'https://example.com/404', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect((result.outputs as { statusCode: number }).statusCode).toBe(404)
    })

    it('returns response object as outputs (context key is applied by executor)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}'),
      } as Response)
      const step: FlowStep = { id: 'myFetch', type: 'http', url: 'https://example.com', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.outputs).toBeDefined()
      expect(result.outputs).toMatchObject({ statusCode: 200, headers: expect.any(Object), body: {} })
    })

    it('returns response object as outputs regardless of outputKey (key applied by executor)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}'),
      } as Response)
      const step: FlowStep = {
        id: 'x',
        type: 'http',
        url: 'https://example.com',
        outputKey: 'apiResult',
        dependsOn: [],
      }
      const result = await handler.run(step, emptyContext)
      expect(result.outputs).toBeDefined()
      expect(result.outputs).toMatchObject({ statusCode: 200 })
    })

    it('returns image response body as base64', async () => {
      const { Buffer } = await import('node:buffer')
      const binary = Buffer.alloc(32, 0x89)
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength)),
      } as Response)
      const step: FlowStep = { id: 'img', type: 'http', url: 'https://example.com/image.png', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      const resp = result.outputs as { statusCode: number, body: string }
      expect(resp.statusCode).toBe(200)
      expect(typeof resp.body).toBe('string')
      expect(resp.body.length).toBeGreaterThan(0)
      expect(() => Buffer.from(resp.body, 'base64')).not.toThrow()
    })

    it('returns failure on fetch error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))
      const step: FlowStep = { id: 'fetch', type: 'http', url: 'https://invalid.example/foo', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('allows localhost by default (no allowlist)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('ok'),
      } as Response)
      const step: FlowStep = { id: 'h1', type: 'http', url: 'http://localhost:8080/', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
    })

    it('when allowedHttpHosts is set, only those hosts are allowed', async () => {
      const step: FlowStep = { id: 'h1', type: 'http', url: 'http://localhost:8080/', dependsOn: [] }
      const ctx: StepContext = { ...emptyContext, allowedHttpHosts: ['api.example.com'] }
      const result = await handler.run(step, ctx)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not allowed|Allowed/)
    })

    it('when allowedHttpHosts includes the request host, request is allowed', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('ok'),
      } as Response)
      const step: FlowStep = { id: 'h1', type: 'http', url: 'http://localhost:8080/', dependsOn: [] }
      const ctx: StepContext = { ...emptyContext, allowedHttpHosts: ['localhost', 'api.example.com'] }
      const result = await handler.run(step, ctx)
      expect(result.success).toBe(true)
    })

    it('run returns validation error when url missing (run path)', async () => {
      const step: FlowStep = { id: 'h1', type: 'http', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('url')
    })

    it('returns failure when url is invalid', async () => {
      const step: FlowStep = { id: 'h1', type: 'http', url: 'not-a-url', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('invalid')
    })

    it('returns failure when protocol is not http or https', async () => {
      const step: FlowStep = { id: 'h1', type: 'http', url: 'file:///etc/passwd', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/https?/)
    })

    it('returns failure and abort message when request is aborted', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      const step: FlowStep = { id: 'h1', type: 'http', url: 'https://example.com/', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/abort/i)
    })

    it('non-string header values are skipped', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      const step = {
        id: 'h1',
        type: 'http',
        url: 'https://example.com/',
        headers: { 'Accept': 'application/json', 'X-Num': 42 },
        dependsOn: [],
      } as FlowStep
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
    })

    it('path replaces pathname of url (url + path → final URL)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      globalThis.fetch = fetchMock
      const step: FlowStep = {
        id: 'h1',
        type: 'http',
        url: 'https://api.example.com',
        path: '/users/123',
        dependsOn: [],
      }
      await handler.run(step, emptyContext)
      expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/users/123', expect.any(Object))
    })

    it('query as object produces application/x-www-form-urlencoded search', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      globalThis.fetch = fetchMock
      const step: FlowStep = {
        id: 'h1',
        type: 'http',
        url: 'https://api.example.com/search',
        query: { q: 'x', limit: '10' },
        dependsOn: [],
      }
      await handler.run(step, emptyContext)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('q=x'),
        expect.any(Object),
      )
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object),
      )
    })

    it('query as string is used as search part', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      globalThis.fetch = fetchMock
      const step: FlowStep = {
        id: 'h1',
        type: 'http',
        url: 'https://api.example.com/search',
        query: 'q=hello&page=1',
        dependsOn: [],
      }
      await handler.run(step, emptyContext)
      const url = (fetchMock.mock.calls[0] as [string])[0]
      expect(url).toContain('q=hello')
      expect(url).toContain('page=1')
    })

    it('cookie sets Cookie header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      globalThis.fetch = fetchMock
      const step: FlowStep = {
        id: 'h1',
        type: 'http',
        url: 'https://api.example.com/',
        cookie: 'session=abc',
        dependsOn: [],
      }
      await handler.run(step, emptyContext)
      const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      expect(init?.headers).toBeDefined()
      const headers = init?.headers as Record<string, string>
      expect(headers.Cookie).toBe('session=abc')
    })

    it('cookie as object serializes to key=value; key2=value2', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      globalThis.fetch = fetchMock
      const step: FlowStep = {
        id: 'h1',
        type: 'http',
        url: 'https://api.example.com/',
        cookie: { session: 'abc', token: 'xyz' },
        dependsOn: [],
      }
      await handler.run(step, emptyContext)
      const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      const headers = init?.headers as Record<string, string>
      expect(headers.Cookie).toContain('session=abc')
      expect(headers.Cookie).toContain('token=xyz')
    })

    it('cookie overrides headers.Cookie when both set', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{}'),
      } as Response)
      globalThis.fetch = fetchMock
      const step: FlowStep = {
        id: 'h1',
        type: 'http',
        url: 'https://api.example.com/',
        headers: { Cookie: 'old=value' },
        cookie: 'session=new',
        dependsOn: [],
      }
      await handler.run(step, emptyContext)
      const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      const headers = init?.headers as Record<string, string>
      expect(headers.Cookie).toBe('session=new')
    })
  })
})
