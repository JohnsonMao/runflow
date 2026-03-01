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

  describe('validate', () => {
    it('returns true when step has items, entry, and no iterationCompleteSignals (optional)', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2],
        entry: ['body'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns true when step has items, entry, and empty iterationCompleteSignals', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2],
        entry: ['body'],
        iterationCompleteSignals: [],
        dependsOn: [],
      }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no driver (items or count)', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', entry: ['b'], iterationCompleteSignals: [], dependsOn: [] }
      expect(handler.validate(step)).toContain('exactly one of')
      expect(handler.validate(step)).toMatch(/items|count/)
    })

    it('returns error when step has empty entry', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', items: [1], entry: [], iterationCompleteSignals: [], dependsOn: [] }
      expect(handler.validate(step)).toContain('entry')
    })

    it('returns error when step has both drivers (items and count)', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1],
        count: 2,
        entry: ['b'],
        iterationCompleteSignals: [],
        dependsOn: [],
      }
      expect(handler.validate(step)).toContain('exactly one')
    })

    it('returns error when step.iterationCompleteSignals is not an array', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        iterationCompleteSignals: 'not an array' as any,
        dependsOn: [],
      }
      expect(handler.validate(step)).toContain('iterationCompleteSignals')
    })

    it('returns true when step has count, entry, and iterationCompleteSignals', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        count: 1,
        entry: ['body'],
        iterationCompleteSignals: ['b'],
        dependsOn: [],
      }
      expect(handler.validate(step)).toBe(true)
    })
  })

  describe('run', () => {
    it('runs closure per item then returns nextSteps: done (empty iterationCompleteSignals)', async () => {
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
        iterationCompleteSignals: [], // No specific signal, iteration completes on successful sub-flow
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 3, items: [1, 2, 3] })
      expect(run).toHaveBeenCalledTimes(3)
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
        iterationCompleteSignals: [],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      const stepIds = (result.subSteps ?? []).map(s => s.stepId)
      expect(stepIds).toEqual(['l1.iteration_1', 'l1.iteration_1.body', 'l1.iteration_2', 'l1.iteration_2.body'])
      expect(result.log).toBe('done, 2 iteration(s)')
    })

    it('runs closure N times with count then returns nextSteps: done (empty iterationCompleteSignals)', async () => {
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
        iterationCompleteSignals: [],
        dependsOn: [],
      }
      const result = await handler.run(step, ctx({ run }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['after'])
      expect(result.outputs).toMatchObject({ count: 2 })
      expect(run).toHaveBeenCalledTimes(2)
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
      expect(run).toHaveBeenNthCalledWith(1, expect.any(Object), expect.objectContaining({ item: 'a', index: 0, items: ['a', 'b'] }))
      expect(run).toHaveBeenNthCalledWith(2, expect.any(Object), expect.objectContaining({ item: 'b', index: 1, items: ['a', 'b'] }))
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
})
