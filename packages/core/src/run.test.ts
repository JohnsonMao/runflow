import type { HandlerConfig } from './handler-factory'
import type { FlowDefinition, FlowStep } from './types'
import { describe, expect, it } from 'vitest'
import { run } from './run'
import { normalizeStepIds } from './utils'

function createStubRegistry(): Record<string, HandlerConfig> {
  const stubHandler: HandlerConfig = {
    type: 'step',
    run: async (ctx) => {
      ctx.report({ success: true, outputs: { [ctx.step.id]: { ...ctx.params } } })
    },
  }
  const reg: Record<string, HandlerConfig> = {}
  reg.step = stubHandler
  reg.flow = stubHandler
  return reg
}

describe('run', () => {
  it('registry required when flow has steps', async () => {
    const flow: FlowDefinition = {
      name: 'need-reg',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    await expect(run(flow, {})).rejects.toThrow('registry is required when flow has steps')
  })

  describe('allowed dependents (getAllowedDependentIds) validation', () => {
    const conditionHandlerWithRestrict: HandlerConfig = {
      type: 'condition',
      flowControl: {
        getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      },
      run: async (ctx) => {
        ctx.report({ success: true, nextSteps: ['thenStep'] })
      },
    }

    it('fails before any step runs when a step not in then/else depends on condition', async () => {
      const reg = createStubRegistry()
      reg.condition = conditionHandlerWithRestrict
      const flow: FlowDefinition = {
        name: 'invalid-dep',
        steps: [
          { id: 'init', type: 'step', dependsOn: [] },
          { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'], dependsOn: ['init'] },
          { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
          { id: 'elseStep', type: 'step', dependsOn: ['cond'] },
          { id: 'other', type: 'step', dependsOn: ['cond'] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(false)
      expect(result.steps).toHaveLength(0)
      expect(result.error).toContain('cond')
      expect(result.error).toContain('other')
    })

    it('succeeds when only then/else steps depend on condition', async () => {
      const reg = createStubRegistry()
      reg.condition = conditionHandlerWithRestrict
      const flow: FlowDefinition = {
        name: 'valid-dep',
        steps: [
          { id: 'init', type: 'step', dependsOn: [] },
          { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'], dependsOn: ['init'] },
          { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
          { id: 'elseStep', type: 'step', dependsOn: ['cond'] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(true)
      expect(result.steps.length).toBeGreaterThan(0)
    })

    it('dry-run fails with same error when allowed dependents violated', async () => {
      const reg = createStubRegistry()
      reg.condition = conditionHandlerWithRestrict
      const flow: FlowDefinition = {
        name: 'invalid-dry',
        steps: [
          { id: 'init', type: 'step', dependsOn: [] },
          { id: 'cond', type: 'condition', when: 'true', then: ['thenStep'], else: ['elseStep'], dependsOn: ['init'] },
          { id: 'thenStep', type: 'step', dependsOn: ['cond'] },
          { id: 'other', type: 'step', dependsOn: ['cond'] },
        ],
      }
      const result = await run(flow, { registry: reg, dryRun: true })
      expect(result.success).toBe(false)
      expect(result.error).toContain('cond')
      expect(result.error).toContain('other')
    })
  })

  it('params declaration: missing required param yields flow-level error before any step', async () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'a', type: 'string', required: true }],
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('a')
  })

  it('params declaration: valid params pass and steps see context', async () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'a', type: 'string', required: true }],
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry(), params: { a: 'x' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ s1: { a: 'x' } })
  })

  it('params declaration: wrong param type yields flow-level error before any step', async () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'n', type: 'number' }],
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry(), params: { n: 'not-a-number' } })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/number/)
  })

  it('effectiveParamsDeclaration: when provided, validates and applies defaults instead of flow.params', async () => {
    const flow: FlowDefinition = {
      name: 'no-params',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const effective = [
      { name: 'env', type: 'string' as const, default: 'development' },
      { name: 'count', type: 'number' as const, default: 1 },
    ]
    const result = await run(flow, {
      registry: createStubRegistry(),
      effectiveParamsDeclaration: effective,
      params: { count: 2 },
    })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ s1: { env: 'development', count: 2 } })
  })

  it('effectiveParamsDeclaration: when absent, flow.params is used (unchanged behavior)', async () => {
    const flow: FlowDefinition = {
      name: 'with-params',
      params: [{ name: 'a', type: 'string', default: 'from-flow' }],
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ s1: { a: 'from-flow' } })
  })

  it('dag cycle returns flow error and no steps run', async () => {
    const flow: FlowDefinition = {
      name: 'cycle',
      steps: [
        { id: 'a', type: 'step', dependsOn: ['c'] },
        { id: 'b', type: 'step', dependsOn: ['a'] },
        { id: 'c', type: 'step', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toContain('Cycle')
  })

  it('dag dependency on missing step id returns error', async () => {
    const flow: FlowDefinition = {
      name: 'dep-missing',
      steps: [
        { id: 'b', type: 'step', dependsOn: ['missing'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toMatch(/not in the DAG|missing/)
  })
})
