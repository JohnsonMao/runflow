import type { RunSubFlowImplDeps } from './executor'
import type { FlowDefinition, FlowStep, IStepHandler, StepContext, StepResult } from './types'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { run, runSubFlowImpl } from './executor'
import { stepResult } from './stepResult'
import { normalizeStepIds } from './utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Stub handler: always valid, no-op kill, returns success with params snapshot in outputs (for context accumulation tests). */
const stubHandler: IStepHandler = {
  validate: () => true,
  kill: () => {},
  run: async (step: FlowStep, context: StepContext): Promise<StepResult> => {
    return context.stepResult(step.id, true, {
      outputs: { [step.id]: { ...context.params } },
    })
  },
}

/** Stub that returns step in outputs so executor substitution can be asserted. */
const stubHandlerWithStepSnapshot: IStepHandler = {
  validate: () => true,
  kill: () => {},
  run: async (step: FlowStep, context: StepContext): Promise<StepResult> => {
    return context.stepResult(step.id, true, {
      outputs: { [step.id]: { step: { ...step } } },
    })
  },
}

function createStubRegistry(): Record<string, IStepHandler> {
  const reg: Record<string, IStepHandler> = {}
  reg.step = stubHandler
  reg.flow = stubHandler
  return reg
}

describe('runSubFlowImpl', () => {
  it('returns error when bodyStepIds contain non-existent step id', async () => {
    const stepByIdMap = new Map<string, FlowStep>([['a', { id: 'a', type: 'step', dependsOn: [] }]])
    const steps: StepResult[] = []
    const runStepById = async () => ({ result: stepResult('a', true), newContext: {} })
    const deps: RunSubFlowImplDeps = {
      stepByIdMap,
      dagOrder: ['a'],
      steps,
      runStepById,
    }
    const out = await runSubFlowImpl(['a', 'nonexistent'], {}, deps)
    expect(out.error).toBeDefined()
    expect(out.error).toMatch(/Step\(s\) not found|nonexistent/)
    expect(out.results).toHaveLength(0)
  })

  it('pushes each body result to deps.steps and returns results + newContext', async () => {
    const stepByIdMap = new Map<string, FlowStep>([
      ['a', { id: 'a', type: 'step', dependsOn: [] }],
      ['b', { id: 'b', type: 'step', dependsOn: ['a'] }],
    ])
    const steps: StepResult[] = []
    const runStepById = async (id: string, ctx: Record<string, unknown>) => {
      const result = stepResult(id, true, { outputs: { [id]: ctx } })
      return { result, newContext: { ...ctx, [id]: result.outputs } }
    }
    const deps: RunSubFlowImplDeps = {
      stepByIdMap,
      dagOrder: ['a', 'b'],
      steps,
      runStepById,
    }
    const out = await runSubFlowImpl(['a', 'b'], { init: 1 }, deps)
    expect(out.error).toBeUndefined()
    expect(out.results).toHaveLength(2)
    expect(out.results[0].stepId).toBe('a')
    expect(out.results[1].stepId).toBe('b')
    expect(steps).toHaveLength(2)
    expect(steps[0].stepId).toBe('a')
    expect(steps[1].stepId).toBe('b')
    expect(out.newContext).toMatchObject({ init: 1, a: {}, b: {} })
  })
})

describe('run', () => {
  it('dryRun returns success without executing handler', async () => {
    const flow: FlowDefinition = {
      name: 'dry',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry(), dryRun: true })
    expect(result.flowName).toBe('dry')
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].stepId).toBeDefined()
  })

  it('registry required when flow has steps', async () => {
    const flow: FlowDefinition = {
      name: 'need-reg',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    await expect(run(flow, {})).rejects.toThrow('registry is required when flow has steps')
  })

  describe('allowed dependents (getAllowedDependentIds) validation', () => {
    const conditionHandlerWithRestrict: IStepHandler = {
      getAllowedDependentIds: (step: FlowStep) => [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)],
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext): Promise<StepResult> =>
        ctx.stepResult(step.id, true, { nextSteps: ['thenStep'] }),
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

  it('runs multiple steps in DAG order', async () => {
    const flow: FlowDefinition = {
      name: 'order',
      steps: [
        { id: 'a', type: 'step', dependsOn: [] },
        { id: 'b', type: 'step', dependsOn: ['a'] },
        { id: 'c', type: 'step', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps.map(s => s.stepId)).toEqual(['a', 'b', 'c'])
  })

  it('params are passed to step context', async () => {
    const flow: FlowDefinition = {
      name: 'params-flow',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry(), params: { a: '1' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ s1: { a: '1' } })
  })

  it('context accumulation: previous step outputs namespaced by step id for next step', async () => {
    const flow: FlowDefinition = {
      name: 'accum',
      steps: [
        { id: 'j1', type: 'step', dependsOn: [] },
        { id: 'j2', type: 'step', dependsOn: ['j1'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: {} })
    expect(result.steps[1].outputs?.j2).toEqual({ j1: { j1: {} } })
  })

  it('step skip true: step skipped, success result pushed, dependents run with current context', async () => {
    const flow: FlowDefinition = {
      name: 'skip-flow',
      steps: [
        { id: 'a', type: 'step', dependsOn: [] },
        { id: 'b', type: 'step', skip: 'params.skip === true', dependsOn: ['a'] },
        { id: 'c', type: 'step', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry(), params: { skip: true, x: 1 } })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(3)
    expect(result.steps[0].outputs).toEqual({ a: { skip: true, x: 1 } })
    expect(result.steps[1].success).toBe(true)
    expect(result.steps[1].outputs).toBeUndefined()
    expect(result.steps[2].outputs?.c).toMatchObject({ a: { a: { skip: true, x: 1 } } })
  })

  it('step skip absent or false: step runs', async () => {
    const flow: FlowDefinition = {
      name: 'no-skip-flow',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry(), params: { run: true } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ s1: { run: true } })
  })

  it('step timeout: executor fails step with timeout error and calls handler.kill()', async () => {
    let killCalled = false
    const hangHandler: IStepHandler = {
      validate: () => true,
      kill: () => { killCalled = true },
      run: () => new Promise(() => {}),
    }
    const reg = createStubRegistry()
    reg.hang = hangHandler
    const flow: FlowDefinition = {
      name: 'timeout',
      steps: [{ id: 's1', type: 'hang', timeout: 1, dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toMatch(/timeout|timed out/i)
    expect(killCalled).toBe(true)
  })

  it('step retry: executor retries until success', async () => {
    let attempts = 0
    const flakyHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        attempts++
        if (attempts < 3)
          return ctx.stepResult(step.id, false, { error: 'attempt failed' })
        return ctx.stepResult(step.id, true, { outputs: { [step.id]: { ok: true } } })
      },
    }
    const reg = createStubRegistry()
    reg.flaky = flakyHandler
    const flow: FlowDefinition = {
      name: 'retry',
      steps: [{ id: 's1', type: 'flaky', retry: 3, dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(attempts).toBe(3)
    expect(result.steps[0].outputs?.s1).toEqual({ ok: true })
  })

  it('step retry: fails after all attempts', async () => {
    const failHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) =>
        ctx.stepResult(step.id, false, { error: 'always fail' }),
    }
    const reg = createStubRegistry()
    reg.fail = failHandler
    const flow: FlowDefinition = {
      name: 'retry-fail',
      steps: [{ id: 's1', type: 'fail', retry: 2, dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('always fail')
  })

  it('unknown step type: returns error result for that step', async () => {
    const flow: FlowDefinition = {
      name: 'unknown',
      steps: [{ id: 's1', type: 'customType', run: 'x', dependsOn: [] }],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('Unknown step type')
    expect(result.steps[0].error).toContain('customType')
  })

  it('handler that throws: executor catches and returns error result', async () => {
    const throwHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async () => { throw new Error('handler threw') },
    }
    const reg = createStubRegistry()
    reg.willThrow = throwHandler
    const flow: FlowDefinition = {
      name: 'throw-flow',
      steps: [
        { id: 's1', type: 'step', dependsOn: [] },
        { id: 's2', type: 'willThrow', dependsOn: ['s1'] },
      ],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[1].success).toBe(false)
    expect(result.steps[1].error).toContain('handler threw')
  })

  it('handler validate failure: step fails with validation message', async () => {
    const strictHandler: IStepHandler = {
      validate: (step: FlowStep) => (step.run ? true : 'need run'),
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => ctx.stepResult(step.id, true, {}),
    }
    const reg = createStubRegistry()
    reg.strict = strictHandler
    const flow: FlowDefinition = {
      name: 'validate-fail',
      steps: [{ id: 's1', type: 'strict', dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toContain('need run')
  })

  it('custom registry: passed handler is used', async () => {
    const customHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) =>
        ctx.stepResult(step.id, true, { outputs: { value: (step as { payload?: string }).payload ?? '' } }),
    }
    const reg = createStubRegistry()
    reg.custom = customHandler
    const flow: FlowDefinition = {
      name: 'custom-reg',
      steps: [{ id: 's1', type: 'custom', payload: 'hello', dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ value: 'hello' })
  })

  it('template substitution: executor substitutes step fields before handler runs', async () => {
    const reg: Record<string, IStepHandler> = {}
    reg.step = stubHandlerWithStepSnapshot
    const flow: FlowDefinition = {
      name: 'subst',
      steps: [
        {
          id: 'c1',
          type: 'step',
          run: 'echo "{{ a }} {{ obj.b }} {{ arr[0] }}"',
          dependsOn: [],
        },
      ],
    }
    const result = await run(flow, {
      registry: reg,
      params: { a: 'x', obj: { b: 'y' }, arr: ['z'] },
    })
    expect(result.success).toBe(true)
    const stepSnapshot = (result.steps[0].outputs as Record<string, { step: FlowStep }>)?.c1?.step
    expect(stepSnapshot?.run).toBe('echo "x y z"')
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

  it('dag linear chain executes in dependency order', async () => {
    const flow: FlowDefinition = {
      name: 'linear',
      steps: [
        { id: 'a', type: 'step', dependsOn: [] },
        { id: 'b', type: 'step', dependsOn: ['a'] },
        { id: 'c', type: 'step', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps.map(s => s.stepId)).toEqual(['a', 'b', 'c'])
  })

  it('dag orphan steps are excluded from execution', async () => {
    const flow: FlowDefinition = {
      name: 'orphan',
      steps: [
        { id: 'root', type: 'step', dependsOn: [] },
        { id: 'orphan', type: 'step' },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].stepId).toBe('root')
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

  it('dag dependency on orphan returns error', async () => {
    const flow: FlowDefinition = {
      name: 'dep-orphan',
      steps: [
        { id: 'orphan', type: 'step' },
        { id: 'b', type: 'step', dependsOn: ['orphan'] },
      ],
    }
    const result = await run(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toMatch(/not in the DAG|orphan/)
  })

  it('executor provides runFlow in step context when running a flow', async () => {
    const flowHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        const hasRunFlow = typeof ctx.runFlow === 'function'
        return ctx.stepResult(step.id, hasRunFlow, { outputs: { [step.id]: { hasRunFlow } } })
      },
    }
    const reg = createStubRegistry()
    reg.flow = flowHandler
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }],
    }
    const result = await run(flow, {
      registry: reg,
      flowFilePath: path.join(__dirname, 'fixtures', 'flow.yaml'),
    })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs?.f1).toEqual({ hasRunFlow: true })
  })

  it('executor merges appendLog with result.log when handler returns', async () => {
    const appendLogHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        ctx.appendLog?.('line1')
        ctx.appendLog?.('line2')
        return ctx.stepResult(step.id, true, { log: 'done' })
      },
    }
    const reg = createStubRegistry()
    reg.append = appendLogHandler
    const flow: FlowDefinition = {
      name: 'append',
      steps: [{ id: 's1', type: 'append', dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(result.steps[0].log).toBe('line1\nline2\ndone')
  })

  it('executor flattens step result subSteps with prefixed stepId', async () => {
    const flowHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        const subSteps: StepResult[] = [
          stepResult('a', true, { log: 'step a' }),
          stepResult('b', true, { log: 'step b' }),
        ]
        return ctx.stepResult(step.id, true, { outputs: {}, subSteps })
      },
    }
    const reg = createStubRegistry()
    reg.flow = flowHandler
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }],
    }
    const result = await run(flow, { registry: reg })
    expect(result.success).toBe(true)
    const stepIds = result.steps.map(s => s.stepId)
    expect(stepIds).toContain('f1')
    expect(stepIds).toContain('f1.a')
    expect(stepIds).toContain('f1.b')
    const fa = result.steps.find(s => s.stepId === 'f1.a')
    const fb = result.steps.find(s => s.stepId === 'f1.b')
    expect(fa?.log).toBe('step a')
    expect(fb?.log).toBe('step b')
  })

  it('runFlow rejects path traversal (flow path must be under current flow directory)', async () => {
    const flowHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        if (!ctx.runFlow)
          return ctx.stepResult(step.id, false, { error: 'no runFlow' })
        const runResult = await ctx.runFlow('../other/flow.yaml', {})
        return ctx.stepResult(step.id, runResult.success, {
          error: runResult.error,
          outputs: { [step.id]: { calleeError: runResult.error } },
        })
      },
    }
    const reg = createStubRegistry()
    reg.flow = flowHandler
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: '../other/flow.yaml', dependsOn: [] }],
    }
    const result = await run(flow, {
      registry: reg,
      flowFilePath: path.join(__dirname, 'fixtures', 'flow.yaml'),
    })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toMatch(/flow path must be under|flow directory/)
  })

  it('runFlow returns error when max flow-call depth exceeded', async () => {
    const flowHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        if (!ctx.runFlow)
          return ctx.stepResult(step.id, false, { error: 'no runFlow' })
        const flowPath = step.flow
        if (typeof flowPath !== 'string')
          return ctx.stepResult(step.id, false, { error: 'missing flow path' })
        const runResult = await ctx.runFlow(flowPath, {})
        const err = runResult.error ?? runResult.steps?.find(s => s.error)?.error
        return ctx.stepResult(step.id, runResult.success, {
          error: err,
          outputs: { [step.id]: { error: err } },
        })
      },
    }
    const reg = createStubRegistry()
    reg.flow = flowHandler
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'nested.yaml', dependsOn: [] }],
    }
    const result = await run(flow, {
      registry: reg,
      flowFilePath: path.join(__dirname, 'fixtures', 'flow.yaml'),
      maxFlowCallDepth: 1,
    })
    expect(result.success).toBe(false)
    const f1 = result.steps.find(s => s.stepId === 'f1')
    expect(f1?.success).toBe(false)
    expect(f1?.error).toMatch(/depth exceeded|max flow-call depth/)
  })

  it('runFlow returns error when callee flow not found or failed to load', async () => {
    const flowHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        if (!ctx.runFlow)
          return ctx.stepResult(step.id, false, { error: 'no runFlow' })
        const runResult = await ctx.runFlow('nonexistent.yaml', {})
        return ctx.stepResult(step.id, runResult.success, {
          outputs: { [step.id]: { error: runResult.error } },
        })
      },
    }
    const reg = createStubRegistry()
    reg.flow = flowHandler
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'nonexistent.yaml', dependsOn: [] }],
    }
    const result = await run(flow, {
      registry: reg,
      flowFilePath: path.join(__dirname, 'fixtures', 'flow.yaml'),
    })
    expect(result.success).toBe(false)
    const f1 = result.steps.find(s => s.stepId === 'f1')
    expect(f1?.outputs).toBeDefined()
    const out = (f1?.outputs as Record<string, { error?: string }>)?.f1
    expect(out?.error).toMatch(/not found|failed to load/)
  })

  describe('runSubFlow / runStepById (via handler that calls runSubFlow)', () => {
    /** Handler that runs body step ids as a subflow and returns aggregated result. */
    const subflowRunnerHandler: IStepHandler = {
      validate: (step: FlowStep) => (Array.isArray(step.bodyIds) ? true : 'need bodyIds'),
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        const raw = step.bodyIds
        if (!Array.isArray(raw))
          return ctx.stepResult(step.id, false, { error: 'need bodyIds' })
        const bodyIds = raw.filter((x): x is string => typeof x === 'string')
        const out = await ctx.runSubFlow(bodyIds, ctx.params)
        if (out.error)
          return ctx.stepResult(step.id, false, { error: out.error })
        const success = out.results.every(r => r.success)
        return ctx.stepResult(step.id, success, {
          outputs: { [step.id]: out.newContext },
          nextSteps: out.earlyExit?.nextSteps,
        })
      },
    }

    it('runSubFlow with non-existent body ids returns error and step fails', async () => {
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['nonexistent'], dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(false)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].stepId).toBe('runner')
      expect(result.steps[0].success).toBe(false)
      expect(result.steps[0].error).toMatch(/Step\(s\) not found|nonexistent/)
    })

    it('runStepById: unknown step type in subflow returns error and does not throw', async () => {
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['inner'], dependsOn: [] },
          { id: 'inner', type: 'noHandler', dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(false)
      const innerStep = result.steps.find(s => s.stepId === 'inner')
      expect(innerStep?.success).toBe(false)
      expect(innerStep?.error).toContain('Unknown step type')
      expect(innerStep?.error).toContain('noHandler')
    })

    it('runStepById: validate failure in subflow step returns error result', async () => {
      const strictHandler: IStepHandler = {
        validate: (step: FlowStep) => ((step as { need?: string }).need ? true : 'need field'),
        kill: () => {},
        run: async (step: FlowStep, ctx: StepContext) => ctx.stepResult(step.id, true, {}),
      }
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      reg.strict = strictHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['inner'], dependsOn: [] },
          { id: 'inner', type: 'strict', dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(false)
      expect(result.steps[0].error).toContain('need field')
    })

    it('runStepById: skip in subflow step returns success and keeps context', async () => {
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['a', 'b'], dependsOn: [] },
          { id: 'a', type: 'step', skip: 'params.skipA', dependsOn: [] },
          { id: 'b', type: 'step', dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg, params: { skipA: true } })
      expect(result.success).toBe(true)
      const runnerStep = result.steps.find(s => s.stepId === 'runner')
      const runnerOutputs = runnerStep?.outputs as Record<string, Record<string, unknown>>
      expect(runnerOutputs?.runner).toBeDefined()
      expect(runnerOutputs?.runner?.b).toBeDefined()
    })

    it('runStepById: handler throws in subflow step returns error result', async () => {
      const throwHandler: IStepHandler = {
        validate: () => true,
        kill: () => {},
        run: async () => { throw new Error('subflow step threw') },
      }
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      reg.thrower = throwHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['t'], dependsOn: [] },
          { id: 't', type: 'thrower', dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(false)
      expect(result.steps[0].error).toContain('subflow step threw')
    })

    it('runStepById: handler returns no result yields error result', async () => {
      const noResultHandler: IStepHandler = {
        validate: () => true,
        kill: () => {},
        run: async () => undefined as unknown as Promise<StepResult>,
      }
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      reg.bad = noResultHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['bad'], dependsOn: [] },
          { id: 'bad', type: 'bad', dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(false)
      expect(result.steps[0].error).toContain('Handler returned no result')
    })

    it('runSubFlow: only steps in condition nextSteps run (noop allowed, nap2 not)', async () => {
      const condHandler: IStepHandler = {
        validate: () => true,
        kill: () => {},
        run: async (step: FlowStep, ctx: StepContext) =>
          ctx.stepResult(step.id, true, { nextSteps: ['noop'], log: 'branch: else' }),
      }
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      reg.cond = condHandler
      reg.step = stubHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['cond', 'noop', 'nap2'], dependsOn: [] },
          { id: 'cond', type: 'cond', dependsOn: [] },
          { id: 'noop', type: 'step', dependsOn: ['cond'] },
          { id: 'nap2', type: 'step', dependsOn: ['cond'] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(true)
      const stepIds = result.steps.map(s => s.stepId)
      expect(stepIds).toContain('cond')
      expect(stepIds).toContain('noop')
      expect(stepIds).not.toContain('nap2')
    })

    it('runSubFlow: only steps in condition nextSteps run (nap2 allowed, noop not)', async () => {
      const condHandler: IStepHandler = {
        validate: () => true,
        kill: () => {},
        run: async (step: FlowStep, ctx: StepContext) =>
          ctx.stepResult(step.id, true, { nextSteps: ['nap2'], log: 'branch: then' }),
      }
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      reg.cond = condHandler
      reg.step = stubHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['cond', 'noop', 'nap2'], dependsOn: [] },
          { id: 'cond', type: 'cond', dependsOn: [] },
          { id: 'noop', type: 'step', dependsOn: ['cond'] },
          { id: 'nap2', type: 'step', dependsOn: ['cond'] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(true)
      const stepIds = result.steps.map(s => s.stepId)
      expect(stepIds).toContain('cond')
      expect(stepIds).toContain('nap2')
      expect(stepIds).not.toContain('noop')
    })

    it('runSubFlow: early exit when step returns nextSteps outside body', async () => {
      const earlyExitHandler: IStepHandler = {
        validate: () => true,
        kill: () => {},
        run: async (step: FlowStep, ctx: StepContext) =>
          ctx.stepResult(step.id, true, { nextSteps: ['out'] }),
      }
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      reg.early = earlyExitHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['a'], dependsOn: [] },
          { id: 'a', type: 'early', dependsOn: [] },
        ],
      }
      const result = await run(flow, { registry: reg })
      expect(result.success).toBe(true)
      expect(result.steps[0].nextSteps).toEqual(['out'])
    })

    it('runSubFlow: context accumulation across body steps (outputs namespaced by step id)', async () => {
      const reg = createStubRegistry()
      reg.subflow = subflowRunnerHandler
      const flow: FlowDefinition = {
        name: 'sub',
        steps: [
          { id: 'runner', type: 'subflow', bodyIds: ['a', 'b'], dependsOn: [] },
          { id: 'a', type: 'step', dependsOn: [] },
          { id: 'b', type: 'step', dependsOn: ['a'] },
        ],
      }
      const result = await run(flow, { registry: reg, params: { x: 1 } })
      expect(result.success).toBe(true)
      const runnerStep = result.steps.find(s => s.stepId === 'runner')
      const runnerOutputs = runnerStep?.outputs as Record<string, Record<string, unknown>>
      expect(runnerOutputs?.runner).toBeDefined()
      expect(runnerOutputs?.runner?.a).toBeDefined()
      expect(runnerOutputs?.runner?.b).toMatchObject({ b: { a: { a: { x: 1 } } } })
    })
  })
})
