import { createFactoryContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import messageHandlerFactory from './message'

describe('message handler', () => {
  const factoryContext = createFactoryContext()
  const handler = messageHandlerFactory(factoryContext)

  const createMockContext = (step: any, params = {}) => ({
    step,
    params,
    report: vi.fn(),
    signal: new AbortController().signal,
  })

  describe('schema', () => {
    it('returns true when step has message', () => {
      const step = { id: 'm1', type: 'message', message: 'hello' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when message is missing', () => {
      const step = { id: 'm1', type: 'message' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    it('returns success and logs message', async () => {
      const step = { id: 'm1', type: 'message', message: 'hello world' }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(result?.log).toBe('hello world')
    })
  })
})
