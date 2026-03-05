import { createFactoryContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import flowHandlerFactory from './flow'

describe('flow handler', () => {
  const factoryContext = createFactoryContext()
  const handler = flowHandlerFactory(factoryContext)

  const createMockContext = (step: any, params = {}, run = vi.fn(), flowMap: any = {}) => ({
    step,
    params,
    report: vi.fn(),
    signal: new AbortController().signal,
    run,
    flowMap,
  })

  describe('schema', () => {
    it('returns true when step has flow', () => {
      const step = { id: 'f1', type: 'flow', flow: 'sub.yaml' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when flow is missing', () => {
      const step = { id: 'f1', type: 'flow' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    it('calls run with flow and params', async () => {
      const subSteps = [{ stepId: 'a', success: true }]
      const subFlow = { steps: [] }
      const run = vi.fn(async () => ({
        success: true,
        steps: subSteps,
      }))
      const step = { id: 'f1', type: 'flow', flow: 'sub.yaml', params: { a: 1 } }
      const ctx = createMockContext(step, {}, run, { 'sub.yaml': subFlow })

      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(run).toHaveBeenCalledWith(subFlow, { a: 1 })
    })
  })
})
