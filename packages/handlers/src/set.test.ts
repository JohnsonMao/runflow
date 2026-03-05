import { createFactoryContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import setHandlerFactory from './set'

describe('set handler', () => {
  const factoryContext = createFactoryContext()
  const handler = setHandlerFactory(factoryContext)

  const createMockContext = (step: any, params = {}) => ({
    step,
    params,
    report: vi.fn(),
    signal: new AbortController().signal,
  })

  describe('schema', () => {
    it('returns true when step has set (object)', () => {
      const step = { id: 's1', type: 'set', set: { flag: true } }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when step has no set', () => {
      const step = { id: 's1', type: 'set' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    it('merges set object into outputs', async () => {
      const step = { id: 's1', type: 'set', set: { flag: true, n: 42 } }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(result?.outputs).toEqual({ flag: true, n: 42 })
    })
  })
})
