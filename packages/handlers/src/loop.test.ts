import type { FlowStep, RunSubFlowFn } from '@runflow/core'
import { stepResult } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import { LoopHandler } from './loop'

const noopRunSubFlow: RunSubFlowFn = async () => ({ results: [], newContext: {} })
/** Default steps: only body so closure from entry ['body'] is ['body'] for loop id 'l1'. */
const defaultSteps: FlowStep[] = [
  { id: 'body', type: 'set', dependsOn: ['l1'] },
]

function ctx(overrides: Partial<{
  params: Record<string, unknown>
  runSubFlow: RunSubFlowFn
  steps: FlowStep[]
}> = {}) {
  return {
    params: {},
    runSubFlow: noopRunSubFlow,
    stepResult,
    steps: overrides.steps ?? defaultSteps,
    ...overrides,
  }
}

describe('loop handler', () => {
  const handler = new LoopHandler()

  it('implements getAllowedDependentIds (entry + done)', () => {
    const step = { id: 'l', type: 'loop' as const, count: 1, entry: ['body'], done: ['after'], dependsOn: [] as string[] }
    expect(handler.getAllowedDependentIds(step)).toEqual(['body', 'after'])
  })

  describe('validate', () => {
    it('returns true when step has items and entry', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2],
        entry: ['body'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no driver', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', entry: ['b'], dependsOn: [] }
      expect(handler.validate(step)).toContain('exactly one of')
      expect(handler.validate(step)).toMatch(/items|count|when/)
    })

    it('returns error when step has empty entry', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', items: [1], entry: [], dependsOn: [] }
      expect(handler.validate(step)).toContain('entry')
    })

    it('returns error when step has two drivers (items and count)', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1],
        count: 2,
        entry: ['b'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toContain('exactly one')
    })

    it('returns true when step has when and entry', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        when: 'params.done',
        entry: ['body'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toBe(true)
    })
  })

  describe('run', () => {
    it('runs closure per item then returns nextSteps: done', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2, 3],
        entry: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 3, items: [1, 2, 3] })
      expect(runSubFlow).toHaveBeenCalledTimes(3)
      expect(runSubFlow).toHaveBeenCalledWith(['body'], expect.any(Object), 'l1')
    })

    it('runs closure N times with count then returns nextSteps: done', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 2,
        entry: ['body'],
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
      const stepsForB: FlowStep[] = [{ id: 'b', type: 'set', dependsOn: ['l1'] }]
      let callCount = 0
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => {
        callCount++
        if (callCount === 1) {
          return {
            results: [{ stepId: 'b', success: true }],
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
        entry: ['b'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow, steps: stepsForB }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['early'])
      expect(result.outputs?.count).toBe(1)
      expect(runSubFlow).toHaveBeenCalledTimes(1)
    })

    it('passes item, index, items in body context for items driver', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, outputs: { seen: runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: ['a', 'b'],
        entry: ['body'],
        dependsOn: [],
      }
      await handler.run(step, ctx({ runSubFlow }))
      expect(runSubFlow).toHaveBeenNthCalledWith(1, ['body'], expect.objectContaining({ item: 'a', index: 0, items: ['a', 'b'] }), 'l1')
      expect(runSubFlow).toHaveBeenNthCalledWith(2, ['body'], expect.objectContaining({ item: 'b', index: 1, items: ['a', 'b'] }), 'l1')
    })

    it('items driver with earlyExit returns early with nextSteps and does not run remaining items', async () => {
      const stepsForB: FlowStep[] = [{ id: 'b', type: 'set', dependsOn: ['l1'] }]
      let callCount = 0
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => {
        callCount++
        if (callCount === 1)
          return { results: [{ stepId: 'b', success: true }], newContext: { ...runCtx }, earlyExit: { nextSteps: ['out'] } }
        return { results: [], newContext: runCtx }
      })
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2, 3],
        entry: ['b'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow, steps: stepsForB }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['out'])
      expect(result.outputs).toMatchObject({ count: 1, items: [1, 2, 3] })
      expect(runSubFlow).toHaveBeenCalledTimes(1)
    })

    it('items driver without done returns no nextSteps', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1],
        entry: ['body'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toBeUndefined()
      expect(result.outputs).toMatchObject({ count: 1, items: [1] })
    })

    it('count driver without done returns no nextSteps', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (_bodyStepIds: string[], runCtx: Record<string, unknown>) => ({
        results: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toBeUndefined()
    })
  })

  describe('run (when driver)', () => {
    it('when: exits when expression is true', async () => {
      const runSubFlow = vi.fn<RunSubFlowFn>(async (bodyStepIds: string[], runCtx: Record<string, unknown>) => {
        const index = runCtx.index as number
        const outputs = { iterIndex: String(index), iterCount: String(runCtx.count) }
        return {
          results: [{ stepId: 'body', success: true, outputs }],
          newContext: { ...runCtx, body: outputs },
        }
      })
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        when: 'params.body.iterIndex >= 2',
        entry: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs?.count).toBe(3)
      expect(runSubFlow).toHaveBeenCalledTimes(3)
    })

    it('entry A only, closure A→B→C→D, count 2, done E', async () => {
      const steps: FlowStep[] = [
        { id: 'A', type: 'set', dependsOn: ['loop'] },
        { id: 'B', type: 'set', dependsOn: ['A'] },
        { id: 'C', type: 'set', dependsOn: ['B'] },
        { id: 'D', type: 'set', dependsOn: ['C'] },
      ]
      const runSubFlow = vi.fn<RunSubFlowFn>(async (scopeIds: string[], runCtx: Record<string, unknown>) => ({
        results: scopeIds.map(stepId => ({ stepId, success: true, outputs: { ...runCtx } })),
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 2,
        entry: ['A'],
        done: ['E'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['E'])
      expect(result.outputs?.count).toBe(2)
      expect(runSubFlow).toHaveBeenCalledTimes(2)
      expect(runSubFlow).toHaveBeenCalledWith(['A', 'B', 'C', 'D'], expect.any(Object), 'loop')
    })

    it('entry [A,G] two chains merging at D', async () => {
      const steps: FlowStep[] = [
        { id: 'A', type: 'set', dependsOn: ['loop'] },
        { id: 'B', type: 'set', dependsOn: ['A'] },
        { id: 'C', type: 'set', dependsOn: ['B'] },
        { id: 'G', type: 'set', dependsOn: ['loop'] },
        { id: 'H', type: 'set', dependsOn: ['G'] },
        { id: 'D', type: 'set', dependsOn: ['C', 'H'] },
      ]
      const runSubFlow = vi.fn<RunSubFlowFn>(async (scopeIds: string[], runCtx: Record<string, unknown>) => ({
        results: scopeIds.map(stepId => ({ stepId, success: true })),
        newContext: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 1,
        entry: ['A', 'G'],
        done: ['J'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['J'])
      expect(runSubFlow.mock.calls[0][0].slice().sort()).toEqual(['A', 'B', 'C', 'D', 'G', 'H'])
    })

    it('early exit from step in closure returns nextSteps outside closure', async () => {
      const steps: FlowStep[] = [
        { id: 'A', type: 'set', dependsOn: ['loop'] },
        { id: 'B', type: 'set', dependsOn: ['A'] },
        { id: 'C', type: 'set', dependsOn: ['B'] },
      ]
      let callCount = 0
      const runSubFlow = vi.fn<RunSubFlowFn>(async (scopeIds: string[], runCtx: Record<string, unknown>) => {
        callCount++
        if (callCount === 2)
          return { results: [{ stepId: 'B', success: true }], newContext: { ...runCtx }, earlyExit: { nextSteps: ['F'] } }
        return {
          results: scopeIds.map(stepId => ({ stepId, success: true })),
          newContext: { ...runCtx },
        }
      })
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 3,
        entry: ['A'],
        done: ['E'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ runSubFlow, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['F'])
      expect(result.outputs?.count).toBe(2)
      expect(runSubFlow).toHaveBeenCalledTimes(2)
    })

    it('steps missing or empty returns success: false', async () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ steps: [] }))
      expect(result.success).toBe(false)
      expect(result.error).toContain('steps')
    })
  })
})
