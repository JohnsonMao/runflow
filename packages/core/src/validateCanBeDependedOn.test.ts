import type { FlowDefinition, FlowStep, IStepHandler, StepContext, StepResult } from './types'
import { describe, expect, it } from 'vitest'
import { getDAGStepIds } from './dag'
import { normalizeStepIds } from './utils'
import { validateCanBeDependedOn } from './validateCanBeDependedOn'

function stepById(flow: FlowDefinition): Map<string, FlowStep> {
  const m = new Map<string, FlowStep>()
  for (const s of flow.steps)
    m.set(s.id, s)
  return m
}

describe('validateCanBeDependedOn', () => {
  const noRestrictRegistry: Record<string, IStepHandler> = {
    step: {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext): Promise<StepResult> =>
        ctx.stepResult(step.id, true),
    },
  }

  it('returns null when no handler implements getAllowedDependentIds', () => {
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'a', type: 'step', dependsOn: [] },
        { id: 'b', type: 'step', dependsOn: ['a'] },
      ],
    }
    const stepByIdMap = stepById(flow)
    expect(validateCanBeDependedOn(flow, stepByIdMap, noRestrictRegistry)).toBe(null)
  })

  it('returns null when condition then/else steps depend on condition', () => {
    const conditionHandler: IStepHandler = {
      getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      validate: () => true,
      kill: () => {},
      run: async () => ({ stepId: 'c', success: true }),
    }
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'init', type: 'step', dependsOn: [] },
        { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'], dependsOn: ['init'] },
        { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
        { id: 'elseStep', type: 'step', dependsOn: ['cond'] },
      ],
    }
    const stepByIdMap = stepById(flow)
    const registry = { ...noRestrictRegistry, condition: conditionHandler }
    expect(validateCanBeDependedOn(flow, stepByIdMap, registry)).toBe(null)
  })

  it('returns error when a step not in then/else depends on condition', () => {
    const conditionHandler: IStepHandler = {
      getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      validate: () => true,
      kill: () => {},
      run: async () => ({ stepId: 'c', success: true }),
    }
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'init', type: 'step', dependsOn: [] },
        { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'], dependsOn: ['init'] },
        { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
        { id: 'elseStep', type: 'step', dependsOn: ['cond'] },
        { id: 'other', type: 'step', dependsOn: ['cond'] },
      ],
    }
    const stepByIdMap = stepById(flow)
    const registry = { ...noRestrictRegistry, condition: conditionHandler }
    const err = validateCanBeDependedOn(flow, stepByIdMap, registry)
    expect(err).not.toBe(null)
    expect(err).toContain('cond')
    expect(err).toContain('other')
  })

  it('returns null when loop entry and done steps depend on loop', () => {
    const loopHandler: IStepHandler = {
      getAllowedDependentIds: (step: FlowStep) => [
        ...normalizeStepIds(step.entry),
        ...normalizeStepIds(step.done),
        ...normalizeStepIds(step.end as string | string[] | undefined),
      ],
      validate: () => true,
      kill: () => {},
      run: async () => ({ stepId: 'l', success: true }),
    }
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'init', type: 'step', dependsOn: [] },
        { id: 'loop', type: 'loop', count: 1, entry: ['loopBody'], done: ['nap'], dependsOn: ['init'] },
        { id: 'loopBody', type: 'step', dependsOn: ['loop'] },
        { id: 'nap', type: 'step', dependsOn: ['loop'] },
      ],
    }
    const stepByIdMap = stepById(flow)
    const registry = { ...noRestrictRegistry, loop: loopHandler }
    expect(validateCanBeDependedOn(flow, stepByIdMap, registry)).toBe(null)
  })

  it('returns error when a step not in entry/done depends on loop', () => {
    const loopHandler: IStepHandler = {
      getAllowedDependentIds: (step: FlowStep) => [
        ...normalizeStepIds(step.entry),
        ...normalizeStepIds(step.done),
        ...normalizeStepIds(step.end as string | string[] | undefined),
      ],
      validate: () => true,
      kill: () => {},
      run: async () => ({ stepId: 'l', success: true }),
    }
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'init', type: 'step', dependsOn: [] },
        { id: 'loop', type: 'loop', count: 1, entry: ['loopBody'], done: ['nap'], dependsOn: ['init'] },
        { id: 'loopBody', type: 'step', dependsOn: ['loop'] },
        { id: 'nap', type: 'step', dependsOn: ['loop'] },
        { id: 'other', type: 'step', dependsOn: ['loop'] },
      ],
    }
    const stepByIdMap = stepById(flow)
    const registry = { ...noRestrictRegistry, loop: loopHandler }
    const err = validateCanBeDependedOn(flow, stepByIdMap, registry)
    expect(err).not.toBe(null)
    expect(err).toContain('loop')
    expect(err).toContain('other')
  })

  it('ignores steps not in DAG (no dependsOn)', () => {
    const conditionHandler: IStepHandler = {
      getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      validate: () => true,
      kill: () => {},
      run: async () => ({ stepId: 'c', success: true }),
    }
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'] },
        { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
        { id: 'elseStep', type: 'step', dependsOn: ['cond'] },
      ],
    }
    expect(getDAGStepIds(flow.steps).has('cond')).toBe(false)
    const stepByIdMap = stepById(flow)
    const registry = { ...noRestrictRegistry, condition: conditionHandler }
    expect(validateCanBeDependedOn(flow, stepByIdMap, registry)).toBe(null)
  })
})
