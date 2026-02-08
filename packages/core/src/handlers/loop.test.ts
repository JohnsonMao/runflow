import type { FlowStep, RunSubFlowFn } from '../types'
import { describe, expect, it, vi } from 'vitest'
import { LoopHandler } from './loop'

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
    it('requires runSubFlow in context', async () => {
      const step: FlowStep = { id: 'l1', type: 'loop', items: [1], body: ['b'], dependsOn: [] }
      const result = await handler.run(step, { params: {} })
      expect(result.success).toBe(false)
      expect(result.error).toContain('runSubFlow')
    })

    it('runs body per item then returns nextSteps: done', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds, ctx) => ({
        results: [{ stepId: 'body', success: true, stdout: '', stderr: '', outputs: { ...ctx } }],
        newContext: { ...ctx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2, 3],
        body: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, { params: {}, runSubFlow })
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 3, items: [1, 2, 3] })
      expect(runSubFlow).toHaveBeenCalledTimes(3)
    })

    it('runs body N times with count then returns nextSteps: done', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds, ctx) => ({
        results: [{ stepId: 'body', success: true, stdout: '', stderr: '', outputs: { ...ctx } }],
        newContext: { ...ctx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 2,
        body: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, { params: {}, runSubFlow })
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 2 })
      expect(runSubFlow).toHaveBeenCalledTimes(2)
    })

    it('early exit: returns earlyExit nextSteps and does not run remaining iterations', async () => {
      let callCount = 0
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds, ctx) => {
        callCount++
        if (callCount === 1) {
          return {
            results: [{ stepId: 'b', success: true, stdout: '', stderr: '' }],
            newContext: { ...ctx },
            earlyExit: { nextSteps: ['early'] },
          }
        }
        return {
          results: [],
          newContext: ctx,
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
      const result = await handler.run(step, { params: {}, runSubFlow })
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['early'])
      expect(result.outputs?.count).toBe(1)
      expect(runSubFlow).toHaveBeenCalledTimes(1)
    })

    it('passes item, index, items in body context for items driver', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds, ctx) => ({
        results: [{ stepId: 'body', success: true, stdout: '', stderr: '', outputs: { seen: ctx } }],
        newContext: { ...ctx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: ['a', 'b'],
        body: ['body'],
        dependsOn: [],
      }
      await handler.run(step, { params: {}, runSubFlow })
      expect(runSubFlow).toHaveBeenNthCalledWith(1, ['body'], expect.objectContaining({ item: 'a', index: 0, items: ['a', 'b'] }))
      expect(runSubFlow).toHaveBeenNthCalledWith(2, ['body'], expect.objectContaining({ item: 'b', index: 1, items: ['a', 'b'] }))
    })
  })
})
