import type { HandlerConfig } from './handler-factory'
import type { FlowDefinition, FlowStep } from './types'
import { describe, expect, it } from 'vitest'
import { getDAGStepIds } from './dag'
import { normalizeStepIds } from './utils'
import { validateCanBeDependedOn } from './validateCanBeDependedOn'

describe('validateCanBeDependedOn', () => {
  const noRestrictRegistry: Record<string, HandlerConfig> = {
    step: {
      type: 'step',
      run: async (ctx) => { ctx.report({ success: true }) },
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
    expect(validateCanBeDependedOn(flow, noRestrictRegistry)).toBe(null)
  })

  it('returns null when condition then/else steps depend on condition', () => {
    const conditionHandler: HandlerConfig = {
      type: 'condition',
      flowControl: {
        getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      },
      run: async (ctx) => { ctx.report({ success: true }) },
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
    const registry = { ...noRestrictRegistry, condition: conditionHandler }
    expect(validateCanBeDependedOn(flow, registry)).toBe(null)
  })

  it('returns error when a step not in then/else depends on condition', () => {
    const conditionHandler: HandlerConfig = {
      type: 'condition',
      flowControl: {
        getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      },
      run: async (ctx) => { ctx.report({ success: true }) },
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
    const registry = { ...noRestrictRegistry, condition: conditionHandler }
    const err = validateCanBeDependedOn(flow, registry)
    expect(err).not.toBe(null)
    expect(err).toContain('cond')
    expect(err).toContain('other')
  })

  it('returns null when loop entry and done steps depend on loop', () => {
    const loopHandler: HandlerConfig = {
      type: 'loop',
      flowControl: {
        getAllowedDependentIds: (step: FlowStep) => [
          ...normalizeStepIds(step.entry),
          ...normalizeStepIds(step.done),
          ...normalizeStepIds(step.end as string | string[] | undefined),
        ],
      },
      run: async (ctx) => { ctx.report({ success: true }) },
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
    const registry = { ...noRestrictRegistry, loop: loopHandler }
    expect(validateCanBeDependedOn(flow, registry)).toBe(null)
  })

  it('returns error when a step not in entry/done depends on loop', () => {
    const loopHandler: HandlerConfig = {
      type: 'loop',
      flowControl: {
        getAllowedDependentIds: (step: FlowStep) => [
          ...normalizeStepIds(step.entry),
          ...normalizeStepIds(step.done),
          ...normalizeStepIds(step.end as string | string[] | undefined),
        ],
      },
      run: async (ctx) => { ctx.report({ success: true }) },
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
    const registry = { ...noRestrictRegistry, loop: loopHandler }
    const err = validateCanBeDependedOn(flow, registry)
    expect(err).not.toBe(null)
    expect(err).toContain('loop')
    expect(err).toContain('other')
  })

  it('includes steps with no dependsOn in DAG; canBeDependedOn still validates', () => {
    const conditionHandler: HandlerConfig = {
      type: 'condition',
      flowControl: {
        getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      },
      run: async (ctx) => { ctx.report({ success: true }) },
    }
    const flow: FlowDefinition = {
      name: 'f',
      steps: [
        { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'] },
        { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
        { id: 'elseStep', type: 'step', dependsOn: ['cond'] },
      ],
    }
    expect(getDAGStepIds(flow.steps).has('cond')).toBe(true)
    const registry = { ...noRestrictRegistry, condition: conditionHandler }
    expect(validateCanBeDependedOn(flow, registry)).toBe(null)
  })
})
