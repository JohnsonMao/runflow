import { createFactoryContext } from '@runflow/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import httpHandlerFactory from './http'

describe('http handler', () => {
  const factoryContext = createFactoryContext()
  const handler = httpHandlerFactory(factoryContext)

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('schema', () => {
    it('returns true when step has url', () => {
      const step = { id: 'h1', type: 'http', url: 'https://example.com' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when step has no url', () => {
      const step = { id: 'h1', type: 'http' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    const createMockContext = (step: any, params = {}) => ({
      step,
      params,
      report: vi.fn(),
      signal: new AbortController().signal,
    })

    it('returns success and parsed JSON body for 200 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"key":"value"}'),
      } as Response)
      const step = { id: 'fetch', type: 'http', url: 'https://example.com/json' }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)

      expect(result?.success).toBe(true)
      expect(result?.outputs).toEqual({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: { key: 'value' },
      })
    })

    it('returns image response body as base64', async () => {
      const { Buffer } = await import('node:buffer')
      const binary = Buffer.alloc(32, 0x89)
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength)),
      } as Response)
      const step = { id: 'img', type: 'http', url: 'https://example.com/image.png' }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)

      expect(result?.success).toBe(true)
      const resp = result?.outputs as any
      expect(resp.statusCode).toBe(200)
      expect(typeof resp.body).toBe('string')
      expect(() => Buffer.from(resp.body, 'base64')).not.toThrow()
    })

    it('returns failure on fetch error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))
      const step = { id: 'fetch', type: 'http', url: 'https://invalid.example/foo' }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(false)
      expect(result?.error).toBeDefined()
    })

    it('when allowedHttpHosts is set on step, only those hosts are allowed', async () => {
      const step = {
        id: 'h1',
        type: 'http',
        url: 'http://localhost:8080/',
        allowedHttpHosts: ['api.example.com'],
      }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(false)
      expect(result?.error).toMatch(/not allowed|Allowed/)
    })
  })
})
