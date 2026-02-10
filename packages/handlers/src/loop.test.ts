import type { FlowStep, RunSubFlowFn } from '@runflow/core'
import { stepResult } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import { LoopHandler } from './loop'

const noopRunSubFlow: RunSubFlowFn = async () => ({ results: [], newContext: {} })
function ctx(overrides: Partial<{ params: Record<string, unknown>, runSubFlow: RunSubFlowFn }> = {}) {
  return { params: {}, runSubFlow: noopRunSubFlow, stepResult, ...overrides }
}

describe('loop handler', () => {
  const handler = new LoopHandler()

  describe('validate', () => {
    it('returns true when step has items and body', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2],
        body: ['body'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no driver', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', dependsOn: [] }
      expect(handler.validate(step)).toContain('exactly one of')
      expect(handler.validate(step)).toMatch(/items|count|until/)
    })

    it('returns error when step has empty body', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', items: [1], body: [], dependsOn: [] }
      expect(handler.validate(step)).toContain('body')
    })

    it('returns error when step has two drivers (items and count)', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1],
        count: 2,
        body: ['b'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toContain('exactly one')
    })
  })

  describe('run', () => {
    it('runs body per item then returns nextSteps: done', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, stdout: '', stderr: '', outputs: { ...runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2, 3],
        body: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 3, items: [1, 2, 3] })
      expect(runSubFlow).toHaveBeenCalledTimes(3)
    })

    it('runs body N times with count then returns nextSteps: done', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, stdout: '', stderr: '', outputs: { ...runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 2,
        body: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 2 })
      expect(runSubFlow).toHaveBeenCalledTimes(2)
    })

    it('early exit: returns earlyExit nextSteps and does not run remaining iterations', async () => {
      let callCount = 0
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => {
        callCount++
        if (callCount === 1) {
          return {
            results: [{ stepId: 'b', success: true, stdout: '', stderr: '' }],
            newContext: { ...runCtx },
            earlyExit: { nextSteps: ['early'] },
          }
        }
        return {
          results: [],
          newContext: runCtx,
        }
      })
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 10,
        body: ['b'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['early'])
      expect(result.outputs?.count).toBe(1)
      expect(runSubFlow).toHaveBeenCalledTimes(1)
    })

    it('passes item, index, items in body context for items driver', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, stdout: '', stderr: '', outputs: { seen: runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: ['a', 'b'],
        body: ['body'],
        dependsOn: [],
      }
      await handler.run(step, ctx({ runSubFlow }))
      expect(runSubFlow).toHaveBeenNthCalledWith(1, ['body'], expect.objectContaining({ item: 'a', index: 0, items: ['a', 'b'] }))
      expect(runSubFlow).toHaveBeenNthCalledWith(2, ['body'], expect.objectContaining({ item: 'b', index: 1, items: ['a', 'b'] }))
    })
  })
})
