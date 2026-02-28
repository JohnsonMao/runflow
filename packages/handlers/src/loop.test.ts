import type { FlowDefinition, FlowStep, RunResult, StepContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import { LoopHandler } from './loop'
import { stepResult } from './test-helpers'

/** Default steps: only body so closure from entry ['body'] is ['body'] for loop id 'l1'. */
const defaultSteps: FlowStep[] = [
  { id: 'body', type: 'set', dependsOn: ['l1'] },
]

function ctx(overrides: Partial<{
  params: Record<string, unknown>
  run: NonNullable<StepContext['run']>
  steps: FlowStep[]
  appendLog: (line: string) => void
}> = {}) {
  return {
    params: {},
    stepResult,
    steps: overrides.steps ?? defaultSteps,
    ...overrides,
  } as StepContext
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
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2, 3],
        entry: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 3, items: [1, 2, 3] })
      expect(run).toHaveBeenCalledTimes(3)
      expect(run).toHaveBeenCalledWith(expect.objectContaining({ steps: expect.any(Array) }), expect.any(Object), { scopeStepIds: ['body'] })
    })

    it('subSteps order is iteration_1 → body → iteration_2 → body (complete via loop log)', async () => {
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 2,
        entry: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      const stepIds = (result.subSteps ?? []).map(s => s.stepId)
      expect(stepIds).toEqual(['l1.iteration_1', 'l1.iteration_1.body', 'l1.iteration_2', 'l1.iteration_2.body'])
      expect(result.log).toBe('done, 2 iteration(s)')
    })

    it('runs closure N times with count then returns nextSteps: done', async () => {
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 2,
        entry: ['body'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 2 })
      expect(run).toHaveBeenCalledTimes(2)
    })

    it('early exit: returns earlyExit nextSteps and does not run remaining iterations', async () => {
      const stepsForB: FlowStep[] = [{ id: 'b', type: 'set', dependsOn: ['l1'] }]
      let callCount = 0
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => {
        callCount++
        if (callCount === 1) {
          return {
            success: true,
            steps: [{ stepId: 'b', success: true }],
            finalParams: { ...runCtx },
            earlyExit: { nextSteps: ['early'] },
          }
        }
        return { success: true, steps: [], finalParams: runCtx }
      })
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 10,
        entry: ['b'],
        done: ['after'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run, steps: stepsForB }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['early'])
      expect(result.outputs?.count).toBe(1)
      expect(run).toHaveBeenCalledTimes(1)
    })

    it('passes item, index, items in body context for items driver', async () => {
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: [{ stepId: 'body', success: true, outputs: { seen: runCtx } }],
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: ['a', 'b'],
        entry: ['body'],
        dependsOn: [],
      }
      await handler.run(step, ctx({ run }))
      expect(run).toHaveBeenNthCalledWith(1, expect.any(Object), expect.objectContaining({ item: 'a', index: 0, items: ['a', 'b'] }), expect.any(Object))
      expect(run).toHaveBeenNthCalledWith(2, expect.any(Object), expect.objectContaining({ item: 'b', index: 1, items: ['a', 'b'] }), expect.any(Object))
    })

    it('items driver with earlyExit returns early with nextSteps and does not run remaining items', async () => {
      const stepsForB: FlowStep[] = [{ id: 'b', type: 'set', dependsOn: ['l1'] }]
      let callCount = 0
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => {
        callCount++
        if (callCount === 1)
          return { success: true, steps: [{ stepId: 'b', success: true }], finalParams: { ...runCtx }, earlyExit: { nextSteps: ['out'] } }
        return { success: true, steps: [], finalParams: runCtx }
      })
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2, 3],
        entry: ['b'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run, steps: stepsForB }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['out'])
      expect(result.outputs).toMatchObject({ count: 1, items: [1, 2, 3] })
      expect(run).toHaveBeenCalledTimes(1)
    })

    it('items driver without done returns no nextSteps', async () => {
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1],
        entry: ['body'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toBeUndefined()
      expect(result.outputs).toMatchObject({ count: 1, items: [1] })
    })

    it('count driver without done returns no nextSteps', async () => {
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: [{ stepId: 'body', success: true, outputs: { ...runCtx } }],
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toBeUndefined()
    })
  })

  describe('run (when driver)', () => {
    it('when: exits when expression is true', async () => {
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => {
        const index = runCtx.index as number
        const outputs = { iterIndex: String(index), iterCount: String(runCtx.count) }
        return {
          success: true,
          steps: [{ stepId: 'body', success: true, outputs }],
          finalParams: { ...runCtx, body: outputs },
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
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs?.count).toBe(3)
      expect(run).toHaveBeenCalledTimes(3)
    })

    it('entry A only, closure A→B→C→D, count 2, done E', async () => {
      const steps: FlowStep[] = [
        { id: 'A', type: 'set', dependsOn: ['loop'] },
        { id: 'B', type: 'set', dependsOn: ['A'] },
        { id: 'C', type: 'set', dependsOn: ['B'] },
        { id: 'D', type: 'set', dependsOn: ['C'] },
      ]
      const run = vi.fn(async (_flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: (_flow.steps as FlowStep[]).map(s => ({ stepId: s.id, success: true, outputs: { ...runCtx } })),
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 2,
        entry: ['A'],
        done: ['E'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['E'])
      expect(result.outputs?.count).toBe(2)
      expect(run).toHaveBeenCalledTimes(2)
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ steps: expect.arrayContaining([expect.objectContaining({ id: 'A' }), expect.objectContaining({ id: 'B' }), expect.objectContaining({ id: 'C' }), expect.objectContaining({ id: 'D' })]) }),
        expect.any(Object),
        { scopeStepIds: ['A', 'B', 'C', 'D'] },
      )
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
      const run = vi.fn(async (flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: (flow.steps as FlowStep[]).map(s => ({ stepId: s.id, success: true })),
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 1,
        entry: ['A', 'G'],
        done: ['J'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['J'])
      const bodyStepIds = (run.mock.calls[0][0] as FlowDefinition).steps.map(s => s.id).slice().sort()
      expect(bodyStepIds).toEqual(['A', 'B', 'C', 'D', 'G', 'H'])
    })

    it('early exit from step in closure returns nextSteps outside closure', async () => {
      const steps: FlowStep[] = [
        { id: 'A', type: 'set', dependsOn: ['loop'] },
        { id: 'B', type: 'set', dependsOn: ['A'] },
        { id: 'C', type: 'set', dependsOn: ['B'] },
      ]
      let callCount = 0
      const run = vi.fn(async (flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => {
        callCount++
        if (callCount === 2)
          return { success: true, steps: [{ stepId: 'B', success: true }], finalParams: { ...runCtx }, earlyExit: { nextSteps: ['F'] } }
        return {
          success: true,
          steps: (flow.steps as FlowStep[]).map(s => ({ stepId: s.id, success: true })),
          finalParams: { ...runCtx },
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
      const result = await handler.run(step, ctx({ run, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['F'])
      expect(result.outputs?.count).toBe(2)
      expect(run).toHaveBeenCalledTimes(2)
    })

    it('body excludes done and steps that transitively depend on done (e.g. req→nap)', async () => {
      const steps: FlowStep[] = [
        { id: 'loopBody', type: 'set', dependsOn: ['loop'] },
        { id: 'earlyExitCond', type: 'set', dependsOn: ['loopBody'] },
        { id: 'noop', type: 'set', set: {}, dependsOn: ['earlyExitCond'] },
        { id: 'nap2', type: 'sleep', ms: 0, dependsOn: ['earlyExitCond'] },
        { id: 'nap', type: 'sleep', ms: 0, dependsOn: ['loop'] },
        { id: 'req', type: 'http', url: 'https://x', method: 'GET', dependsOn: ['nap'] },
        { id: 'sub', type: 'flow', flow: 'x', dependsOn: ['req'] },
        { id: 'summary', type: 'set', set: {}, dependsOn: ['sub'] },
      ]
      const run = vi.fn(async (flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: (flow.steps as FlowStep[]).map(s => ({ stepId: s.id, success: true })),
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 1,
        entry: ['loopBody'],
        done: ['nap'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['nap'])
      const bodyStepIds = (run.mock.calls[0][0] as FlowDefinition).steps.map(s => s.id).slice().sort()
      expect(bodyStepIds).toEqual(['earlyExitCond', 'loopBody', 'nap2', 'noop'])
    })

    it('full closure is run: noop and nap2 included when in closure (done steps excluded from body)', async () => {
      const steps: FlowStep[] = [
        { id: 'loopBody', type: 'set', dependsOn: ['loop'] },
        { id: 'earlyExitCond', type: 'set', dependsOn: ['loopBody'] },
        { id: 'noop', type: 'set', set: {}, dependsOn: ['earlyExitCond'] },
        { id: 'nap2', type: 'sleep', ms: 0, dependsOn: ['earlyExitCond'] },
        { id: 'nap', type: 'sleep', ms: 0, dependsOn: ['loop'] },
      ]
      const run = vi.fn(async (flow: FlowDefinition, runCtx: Record<string, unknown>): Promise<RunResult> => ({
        success: true,
        steps: (flow.steps as FlowStep[]).map(s => ({ stepId: s.id, success: true })),
        finalParams: { ...runCtx },
      }))
      const step: FlowStep = {
        id: 'loop',
        type: 'loop',
        count: 2,
        entry: ['loopBody'],
        done: ['nap'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run, steps }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['nap'])
      expect(run).toHaveBeenCalledTimes(2)
      const bodyStepIds = (run.mock.calls[0][0] as FlowDefinition).steps.map(s => s.id).slice().sort()
      expect(bodyStepIds).toEqual(['earlyExitCond', 'loopBody', 'nap2', 'noop'])
    })

    it('steps missing or empty returns success: false', async () => {
      const run = vi.fn(async (): Promise<RunResult> => ({ success: true, steps: [], finalParams: {} }))
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ steps: [], run }))
      expect(result.success).toBe(false)
      expect(result.error).toContain('steps')
    })
  })
})
