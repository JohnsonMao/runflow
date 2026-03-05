import { createFactoryContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import sleepHandlerFactory from './sleep'

describe('sleep handler', () => {
  const factoryContext = createFactoryContext()
  const handler = sleepHandlerFactory(factoryContext)

  const createMockContext = (step: any, params = {}) => ({
    step,
    params,
    report: vi.fn(),
    signal: new AbortController().signal,
  })

  describe('schema', () => {
    it('returns true when step has seconds', () => {
      const step = { id: 'w', type: 'sleep', seconds: 1 }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns true when step has ms', () => {
      const step = { id: 'w', type: 'sleep', ms: 100 }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when step has neither seconds nor ms', () => {
      const step = { id: 'w', type: 'sleep' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    it('waits for seconds then returns success with no outputs', async () => {
      const step = { id: 'wait', type: 'sleep', seconds: 0 }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(result?.outputs).toBeUndefined()
    })

    it('waits for ms then returns success', async () => {
      const step = { id: 'wait', type: 'sleep', ms: 10 }
      const ctx = createMockContext(step)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
    })
  })
})
