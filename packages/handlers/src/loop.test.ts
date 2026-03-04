import type { FlowDefinition, FlowStep, RunResult, StepContext } from '@runflow/core'
import { createFactoryContext, handlerConfigToStepHandler } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import loopHandlerFactory, {
  closureIdsThatDependOnDone,
  computeBackwardClosure,
  computeLoopClosure,
} from './loop'
import { stepResult } from './test-helpers'

function step(id: string, dependsOn: string[]): FlowStep {
  return { id, type: 'set', dependsOn }
}

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

describe('computeLoopClosure', () => {
  const LOOP = 'loop'

  it('single entry chain A→B→C→D', () => {
    const steps: FlowStep[] = [
      step('A', [LOOP]),
      step('B', ['A']),
      step('C', ['B']),
      step('D', ['C']),
    ]
    expect(computeLoopClosure(steps, ['A'], LOOP).sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('multiple entry with merge at D', () => {
    const steps: FlowStep[] = [
      step('A', [LOOP]),
      step('B', ['A']),
      step('C', ['B']),
      step('G', [LOOP]),
      step('H', ['G']),
      step('D', ['C', 'H']),
    ]
    const closure = computeLoopClosure(steps, ['A', 'G'], LOOP).sort()
    expect(closure).toEqual(['A', 'B', 'C', 'D', 'G', 'H'])
  })

  it('empty entry returns empty closure when no step has deps only loop or in-scope', () => {
    const steps: FlowStep[] = [step('A', [LOOP, 'x'])]
    expect(computeLoopClosure(steps, [], LOOP)).toEqual([])
  })

  it('invalid entry id not in flow is omitted; valid entry yields closure', () => {
    const steps: FlowStep[] = [
      step('A', [LOOP]),
      step('B', ['A']),
    ]
    expect(computeLoopClosure(steps, ['Missing', 'A'], LOOP).sort()).toEqual(['A', 'B'])
  })
})

describe('computeBackwardClosure', () => {
  it('returns target ids plus all transitive dependencies', () => {
    const steps: FlowStep[] = [
      step('A', []),
      step('B', ['A']),
      step('C', ['B']),
      step('D', ['C']),
    ]
    const back = computeBackwardClosure(steps, ['D'])
    expect([...back].sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('multiple targets merge ancestors', () => {
    const steps: FlowStep[] = [
      step('entry', []),
      step('L', ['entry']),
      step('R', ['entry']),
      step('noop', ['L']),
      step('nap2', ['R']),
    ]
    const back = computeBackwardClosure(steps, ['noop', 'nap2'])
    expect([...back].sort()).toEqual(['L', 'R', 'entry', 'nap2', 'noop'])
  })
})

describe('closureIdsThatDependOnDone', () => {
  it('returns done ids plus steps that transitively depend on done', () => {
    const steps: FlowStep[] = [
      step('loopBody', ['loop']),
      step('nap', ['loop']),
      step('req', ['nap']),
      step('sub', ['req']),
      step('summary', ['sub']),
    ]
    const closure = ['loopBody', 'nap', 'req', 'sub', 'summary']
    const excluded = closureIdsThatDependOnDone(steps, closure, ['nap'])
    expect([...excluded].sort()).toEqual(['nap', 'req', 'sub', 'summary'])
  })

  it('returns only done when no step in closure depends on done', () => {
    const steps: FlowStep[] = [
      step('body', ['loop']),
      step('after', ['loop']),
    ]
    const closure = ['body', 'after']
    const excluded = closureIdsThatDependOnDone(steps, closure, ['after'])
    expect([...excluded].sort()).toEqual(['after'])
  })
})

describe('loop handler', () => {
  const factoryContext = createFactoryContext()
  const handlerConfig = loopHandlerFactory(factoryContext)
  const handler = handlerConfigToStepHandler(handlerConfig)

  describe('validate', () => {
    it('returns true when step has items, entry, and no iterationCompleteSignals (optional)', () => {
      const step: FlowStep = {
        id: 'l1',
        type: 'loop',
        items: [1, 2],
        entry: ['body'],
        dependsOn: [],
      }
      expect(handler.validate?.(step)).toBe(true)
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
      expect(handler.validate?.(step)).toBe(true)
    })

    it('returns error when step has no driver (items or count)', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', entry: ['b'], iterationCompleteSignals: [], dependsOn: [] }
      expect(handler.validate?.(step)).toContain('exactly one of')
      expect(handler.validate?.(step)).toMatch(/items|count/)
    })

    it('returns error when step has empty entry', () => {
      const step: FlowStep = { id: 'l1', type: 'loop', items: [1], entry: [], iterationCompleteSignals: [], dependsOn: [] }
      expect(handler.validate?.(step)).toContain('entry')
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
      expect(handler.validate?.(step)).toContain('exactly one')
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
      expect(handler.validate?.(step)).toContain('iterationCompleteSignals')
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
      expect(handler.validate?.(step)).toBe(true)
    })
  })

  describe('run', () => {
    it('runs closure once then returns nextSteps: null (empty iterationCompleteSignals)', async () => {
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
      expect(result.nextSteps).toBeNull()
      expect(result.outputs).toMatchObject({ count: 1 })
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
        iterationCompleteSignals: ['body'],
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
      expect(result.nextSteps).toBeNull()
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
      expect(result.nextSteps).toBeNull()
    })
  })
})
