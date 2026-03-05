import { createFactoryContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import loopHandlerFactory from './loop'

describe('loop handler', () => {
  const factoryContext = createFactoryContext()
  const handler = loopHandlerFactory(factoryContext)

  const createMockContext = (step: any, params = {}, run = vi.fn(), steps: any[] = []) => ({
    step,
    params,
    report: vi.fn(),
    signal: new AbortController().signal,
    run,
    steps,
  })

  describe('schema', () => {
    it('returns true when step has items and entry', () => {
      const step = {
        id: 'l1',
        type: 'loop',
        items: [1, 2],
        entry: ['body'],
      }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when step has no driver', () => {
      const step = { id: 'l1', type: 'loop', entry: ['b'] }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    it('runs closure once then returns nextSteps: null', async () => {
      const run = vi.fn(async () => ({
        success: true,
        steps: [{ stepId: 'body', success: true }],
      }))
      const flowSteps = [
        { id: 'l1', type: 'loop' },
        { id: 'body', type: 'set', dependsOn: ['l1'] },
      ]
      const step = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        iterationCompleteSignals: ['body'],
      }
      const ctx = createMockContext(step, {}, run, flowSteps)
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(run).toHaveBeenCalledTimes(1)
    })
  })
})
