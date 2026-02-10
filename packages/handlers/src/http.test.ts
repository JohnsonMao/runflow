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
      expect(result.outputs?.fetch).toBeDefined()
      const resp = result.outputs!.fetch as { statusCode: number, body: unknown }
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
      expect((result.outputs?.fetch as { statusCode: number }).statusCode).toBe(404)
    })

    it('uses step id as output key when outputKey omitted', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{}'),
      } as Response)
      const step: FlowStep = { id: 'myFetch', type: 'http', url: 'https://example.com', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.outputs?.myFetch).toBeDefined()
      expect(result.outputs?.fetch).toBeUndefined()
    })

    it('uses step.outputKey when provided', async () => {
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
      expect(result.outputs?.apiResult).toBeDefined()
      expect(result.outputs?.x).toBeUndefined()
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
      const resp = result.outputs!.img as { statusCode: number, body: string }
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
  })
})
