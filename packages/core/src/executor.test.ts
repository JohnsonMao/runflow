import type { FlowDefinition, FlowStep, IStepHandler, StepContext, StepResult } from './types'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { run } from './executor'

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
    expect(result.steps[0].stdout).toBe('')
  })

  it('registry required when flow has steps', async () => {
    const flow: FlowDefinition = {
      name: 'need-reg',
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    await expect(run(flow, {})).rejects.toThrow('registry is required when flow has steps')
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

  it('context accumulation: previous step outputs merged into params for next step', async () => {
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
    expect(result.steps[1].outputs?.j2).toEqual({ j1: {} })
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
    expect(result.steps[2].outputs?.c).toMatchObject({ a: { skip: true, x: 1 } })
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
})
