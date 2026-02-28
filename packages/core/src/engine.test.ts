import type { FlowDefinition, FlowStep, IStepHandler, RunResult, StepContext, StepResult } from './types'
import { describe, expect, it } from 'vitest'
import { executeFlow, stepResult } from './engine'
import { run } from './run'

function runEngine(flow: FlowDefinition, options: Parameters<typeof executeFlow>[1]): Promise<RunResult> {
  const initialParams = { ...(options.params ?? {}) }
  return executeFlow(flow, options, initialParams, run)
}

const stubHandler: IStepHandler = {
  validate: () => true,
  kill: () => {},
  run: async (step: FlowStep, context: StepContext): Promise<StepResult> =>
    context.stepResult(step.id, true, { outputs: { [step.id]: { ...context.params } } }),
}

const stubHandlerWithStepSnapshot: IStepHandler = {
  validate: () => true,
  kill: () => {},
  run: async (step: FlowStep, context: StepContext): Promise<StepResult> =>
    context.stepResult(step.id, true, {
      outputs: { [step.id]: { step: { ...step } } },
    }),
}

const plainOutputHandler: IStepHandler = {
  validate: () => true,
  kill: () => {},
  run: async (step: FlowStep, context: StepContext): Promise<StepResult> =>
    context.stepResult(step.id, true, { outputs: { value: step.id, from: 'plain' } }),
}

/** Flow step handler that looks up flow from context.flowMap and calls context.run(flow, params). */
function flowHandlerUsingFlowMap(): IStepHandler {
  return {
    validate: () => true,
    kill: () => {},
    run: async (step: FlowStep, ctx: StepContext) => {
      if (!ctx.run)
        return ctx.stepResult(step.id, false, { error: 'no run' })
      const flowId = step.flow as string
      const flow = ctx.flowMap?.[flowId]
      if (!flow)
        return ctx.stepResult(step.id, false, { error: 'flow not found', outputs: { [step.id]: { error: 'flow not found' } } })
      const runResult = await ctx.run(flow, {})
      return ctx.stepResult(step.id, runResult.success, {
        error: runResult.error,
        outputs: runResult.success ? { merged: true } : { [step.id]: { error: runResult.error } },
        subSteps: runResult.steps,
      })
    },
  }
}

function createStubRegistry(): Record<string, IStepHandler> {
  const reg: Record<string, IStepHandler> = {}
  reg.step = stubHandler
  reg.flow = stubHandler
  return reg
}

/** Handler that runs body step ids via context.run(subFlow, params, { scopeStepIds }) and returns aggregated result. */
const subflowRunnerHandler: IStepHandler = {
  validate: (step: FlowStep) => (Array.isArray(step.bodyIds) ? true : 'need bodyIds'),
  kill: () => {},
  run: async (step: FlowStep, ctx: StepContext) => {
    const raw = step.bodyIds
    if (!Array.isArray(raw))
      return ctx.stepResult(step.id, false, { error: 'need bodyIds' })
    const bodyIds = raw.filter((x): x is string => typeof x === 'string')
    const flowSteps = ctx.steps ?? []
    const stepIds = new Set(flowSteps.map(s => s.id))
    const missing = bodyIds.filter(id => !stepIds.has(id))
    if (missing.length > 0)
      return ctx.stepResult(step.id, false, { error: `Step(s) not found: ${missing.join(', ')}` })
    const scopeSet = new Set(bodyIds)
    const subSteps = flowSteps
      .filter(s => scopeSet.has(s.id))
      .map(s => ({
        ...s,
        dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.filter(dep => scopeSet.has(dep)) : [],
      }))
    const subFlow: FlowDefinition = { steps: subSteps }
    if (!ctx.run)
      return ctx.stepResult(step.id, false, { error: 'run not available' })
    const runResult = await ctx.run(subFlow, ctx.params, { scopeStepIds: bodyIds })
    const success = runResult.steps.every(r => r.success)
    const failed = runResult.steps.find(r => !r.success)
    const errorMsg = !success ? (failed?.error ?? runResult.error ?? 'subflow failed') : undefined
    return ctx.stepResult(step.id, success, {
      ...(errorMsg && { error: errorMsg }),
      outputs: { [step.id]: runResult.finalParams ?? {} },
      nextSteps: runResult.earlyExit?.nextSteps,
    })
  },
}

describe('executeFlow', () => {
  it('dryRun returns success and one step result when flow has one step', async () => {
    const flow: FlowDefinition = {
      name: 'dry',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: createStubRegistry(), dryRun: true })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].stepId).toBe('s1')
    expect(result.steps[0].success).toBe(true)
  })

  it('stepResult builds result with stepId and optional outputs', () => {
    const r = stepResult('s1', true, { outputs: { s1: { x: 1 } } })
    expect(r.stepId).toBe('s1')
    expect(r.success).toBe(true)
    expect(r.outputs).toEqual({ s1: { x: 1 } })
  })

  it('runs single step with plainOutputHandler and passes params to outputs', async () => {
    const reg = createStubRegistry()
    reg.plain = plainOutputHandler
    const flow: FlowDefinition = {
      name: 'plain',
      steps: [{ id: 'p1', type: 'plain', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg, params: { a: 'b' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ value: 'p1', from: 'plain' })
  })

  it('stubHandlerWithStepSnapshot exposes step snapshot in outputs', async () => {
    const reg = createStubRegistry()
    reg.snap = stubHandlerWithStepSnapshot
    const flow: FlowDefinition = {
      name: 'snap',
      steps: [{ id: 's1', type: 'snap', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    const out = result.steps[0].outputs?.s1 as { step: FlowStep }
    expect(out?.step?.id).toBe('s1')
    expect(out?.step?.type).toBe('snap')
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
    const result = await runEngine(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps.map(s => s.stepId)).toEqual(['a', 'b', 'c'])
  })

  it('params are passed to step context', async () => {
    const flow: FlowDefinition = {
      name: 'params-flow',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: createStubRegistry(), params: { a: '1' } })
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
    const result = await runEngine(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: {} })
    expect(result.steps[1].outputs?.j2).toEqual({ j1: { j1: {} } })
  })

  it('effectiveKey: step with outputKey writes to context under outputKey for downstream step', async () => {
    const reg = createStubRegistry()
    reg.plain = plainOutputHandler
    const flow: FlowDefinition = {
      name: 'outputKey-flow',
      steps: [
        { id: 'a', type: 'plain', outputKey: 'customKey', dependsOn: [] },
        { id: 'b', type: 'step', dependsOn: ['a'] },
      ],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toMatchObject({ value: 'a', from: 'plain' })
    expect(result.steps[1].outputs?.b).toMatchObject({ customKey: { value: 'a', from: 'plain' } })
  })

  it('effectiveKey: step without outputKey writes to context under step id', async () => {
    const reg = createStubRegistry()
    reg.plain = plainOutputHandler
    const flow: FlowDefinition = {
      name: 'no-outputKey-flow',
      steps: [
        { id: 'a', type: 'plain', dependsOn: [] },
        { id: 'b', type: 'step', dependsOn: ['a'] },
      ],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(result.steps[1].outputs?.b).toMatchObject({ a: { value: 'a', from: 'plain' } })
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
    const result = await runEngine(flow, { registry: createStubRegistry(), params: { skip: true, x: 1 } })
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
    const result = await runEngine(flow, { registry: createStubRegistry(), params: { run: true } })
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toMatch(/timeout|timed out/i)
    expect(killCalled).toBe(true)
  })

  it('step failure: returns error result for failed step', async () => {
    const failHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) =>
        ctx.stepResult(step.id, false, { error: 'always fail' }),
    }
    const reg = createStubRegistry()
    reg.fail = failHandler
    const flow: FlowDefinition = {
      name: 'fail-step',
      steps: [{ id: 's1', type: 'fail', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('always fail')
  })

  it('unknown step type: returns error result for that step', async () => {
    const flow: FlowDefinition = {
      name: 'unknown',
      steps: [{ id: 's1', type: 'customType', run: 'x', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: createStubRegistry() })
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
    const result = await runEngine(flow, { registry: reg })
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
    const result = await runEngine(flow, { registry: reg })
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
    const result = await runEngine(flow, { registry: reg })
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
    const result = await runEngine(flow, {
      registry: reg,
      params: { a: 'x', obj: { b: 'y' }, arr: ['z'] },
    })
    expect(result.success).toBe(true)
    const stepSnapshot = (result.steps[0].outputs as Record<string, { step: FlowStep }>)?.c1?.step
    expect(stepSnapshot?.run).toBe('echo "x y z"')
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
    const result = await runEngine(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps.map(s => s.stepId)).toEqual(['a', 'b', 'c'])
  })

  it('steps with no dependsOn are executed as roots', async () => {
    const flow: FlowDefinition = {
      name: 'roots',
      steps: [
        { id: 'root', type: 'step', dependsOn: [] },
        { id: 'noDeps', type: 'step' },
      ],
    }
    const result = await runEngine(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(2)
    expect(result.steps.map(s => s.stepId).sort()).toEqual(['noDeps', 'root'])
  })

  it('executor provides run in step context when running a flow', async () => {
    const flowHandler: IStepHandler = {
      validate: () => true,
      kill: () => {},
      run: async (step: FlowStep, ctx: StepContext) => {
        const hasRun = typeof ctx.run === 'function'
        return ctx.stepResult(step.id, hasRun, { outputs: { [step.id]: { hasRun } } })
      },
    }
    const reg = createStubRegistry()
    reg.flow = flowHandler
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'sub', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg, flowMap: {} })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs?.f1).toEqual({ hasRun: true })
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
    const result = await runEngine(flow, { registry: reg })
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
      steps: [{ id: 'f1', type: 'flow', flow: 'sub', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg })
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

  it('run returns error when flowMap key missing (handler reports flow not found)', async () => {
    const reg = createStubRegistry()
    reg.flow = flowHandlerUsingFlowMap()
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: '../other/flow.yaml', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg, flowMap: {} })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toMatch(/flow not found/)
  })

  it('run returns error when max flow-call depth exceeded', async () => {
    const nestedFlow: FlowDefinition = {
      name: 'nested',
      steps: [{ id: 'n2', type: 'flow', flow: 'deeper', dependsOn: [] }],
    }
    const deeperFlow: FlowDefinition = {
      name: 'deeper',
      steps: [{ id: 'd1', type: 'step', dependsOn: [] }],
    }
    const reg = createStubRegistry()
    reg.flow = flowHandlerUsingFlowMap()
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'nested.yaml', dependsOn: [] }],
    }
    const result = await runEngine(flow, {
      registry: reg,
      flowMap: { 'nested.yaml': nestedFlow, 'deeper': deeperFlow },
      maxFlowCallDepth: 1,
    })
    expect(result.success).toBe(false)
    const f1 = result.steps.find(s => s.stepId === 'f1')
    const n2 = result.steps.find(s => s.stepId === 'f1.n2')
    expect(f1?.success).toBe(false)
    const err = f1?.error ?? n2?.error ?? (f1?.outputs as Record<string, { error?: string }>)?.f1?.error
    expect(err).toBeDefined()
    expect(String(err)).toMatch(/depth exceeded|max flow-call depth/)
  })

  it('run with flowMap resolves flow id and runs returned flow; nested flow step uses same flowMap', async () => {
    const calleeFlow: FlowDefinition = {
      name: 'resolved-callee',
      steps: [{ id: 'c1', type: 'step', dependsOn: [] }],
    }
    const reg = createStubRegistry()
    reg.flow = flowHandlerUsingFlowMap()
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'my-flow-id', dependsOn: [] }],
    }
    const result = await runEngine(flow, {
      registry: reg,
      flowMap: { 'my-flow-id': calleeFlow },
    })
    expect(result.success).toBe(true)
    const f1 = result.steps.find(s => s.stepId === 'f1')
    expect(f1?.success).toBe(true)
    expect(f1?.outputs?.merged).toBe(true)
    const c1 = result.steps.find(s => s.stepId === 'f1.c1')
    expect(c1).toBeDefined()
    expect(c1?.success).toBe(true)
  })

  it('run when flowMap missing key yields flow not found error', async () => {
    const reg = createStubRegistry()
    reg.flow = flowHandlerUsingFlowMap()
    const flow: FlowDefinition = {
      name: 'caller',
      steps: [{ id: 'f1', type: 'flow', flow: 'unknown-id', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg, flowMap: {} })
    expect(result.success).toBe(false)
    const f1 = result.steps.find(s => s.stepId === 'f1')
    expect(f1?.success).toBe(false)
    expect(f1?.error).toMatch(/flow not found/)
  })
})

describe('run (context.run with scopeStepIds via handler that builds sub-flow)', () => {
  it('runSteps with non-existent body ids returns error and step fails', async () => {
    const reg = createStubRegistry()
    reg.subflow = subflowRunnerHandler
    const flow: FlowDefinition = {
      name: 'sub',
      steps: [
        { id: 'runner', type: 'subflow', bodyIds: ['nonexistent'], dependsOn: [] },
      ],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].stepId).toBe('runner')
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toMatch(/Step\(s\) not found|nonexistent/)
  })

  it('unknown step type in subflow returns error and does not throw', async () => {
    const reg = createStubRegistry()
    reg.subflow = subflowRunnerHandler
    const flow: FlowDefinition = {
      name: 'sub',
      steps: [
        { id: 'runner', type: 'subflow', bodyIds: ['inner'], dependsOn: [] },
        { id: 'inner', type: 'noHandler', dependsOn: [] },
      ],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    const innerStep = result.steps.find(s => s.stepId === 'inner')
    expect(innerStep?.success).toBe(false)
    expect(innerStep?.error).toContain('Unknown step type')
    expect(innerStep?.error).toContain('noHandler')
  })

  it('validate failure in subflow step returns error result', async () => {
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toContain('need field')
  })

  it('skip in subflow step returns success and keeps context', async () => {
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
    const result = await runEngine(flow, { registry: reg, params: { skipA: true } })
    expect(result.success).toBe(true)
    const runnerStep = result.steps.find(s => s.stepId === 'runner')
    const runnerOutputs = runnerStep?.outputs as Record<string, Record<string, unknown>>
    expect(runnerOutputs?.runner).toBeDefined()
    expect(runnerOutputs?.runner?.b).toBeDefined()
  })

  it('handler throws in subflow step returns error result', async () => {
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toContain('subflow step threw')
  })

  it('handler returns no result yields error result', async () => {
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toContain('Handler returned no result')
  })

  it('only steps in condition nextSteps run (noop allowed, nap2 not)', async () => {
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    const stepIds = result.steps.map(s => s.stepId)
    expect(stepIds).toContain('cond')
    expect(stepIds).toContain('noop')
    expect(stepIds).not.toContain('nap2')
  })

  it('only steps in condition nextSteps run (nap2 allowed, noop not)', async () => {
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    const stepIds = result.steps.map(s => s.stepId)
    expect(stepIds).toContain('cond')
    expect(stepIds).toContain('nap2')
    expect(stepIds).not.toContain('noop')
  })

  it('early exit when step returns nextSteps outside body', async () => {
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
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(result.steps[0].nextSteps).toEqual(['out'])
  })

  it('context accumulation across body steps (outputs namespaced by step id)', async () => {
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
    const result = await runEngine(flow, { registry: reg, params: { x: 1 } })
    expect(result.success).toBe(true)
    const runnerStep = result.steps.find(s => s.stepId === 'runner')
    const runnerOutputs = runnerStep?.outputs as Record<string, Record<string, unknown>>
    expect(runnerOutputs?.runner).toBeDefined()
    expect(runnerOutputs?.runner?.a).toBeDefined()
    expect(runnerOutputs?.runner?.b).toMatchObject({ b: { a: { a: { x: 1 } } } })
  })
})
