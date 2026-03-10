import type { HandlerConfig } from './handler-factory'
import type { FlowDefinition, RunResult, StepResult } from './types'
import { describe, expect, it, vi } from 'vitest'
import { executeFlow, stepResult } from './engine'
import { run } from './run'

const terminatorSubStepHandler: HandlerConfig = {
  type: 'terminator',
  run: async (ctx) => {
    ctx.report({ success: true, nextSteps: null, log: `terminated by ${ctx.step.id}` })
  },
}

const loopTerminatingStubHandler: HandlerConfig = {
  type: 'loop',
  run: async (ctx) => {
    ctx.report({ success: true, nextSteps: null, log: `Loop terminated by stub` })
  },
}

function runEngine(flow: FlowDefinition, options: Parameters<typeof executeFlow>[1]): Promise<RunResult> {
  const initialParams = { ...(options.params ?? {}) }
  return executeFlow(flow, options, initialParams, run)
}

const stubHandler: HandlerConfig = {
  type: 'step',
  run: async (ctx) => {
    ctx.report({ success: true, outputs: { [ctx.step.id]: { ...ctx.params } } })
  },
}

const stubHandlerWithStepSnapshot: HandlerConfig = {
  type: 'snap',
  run: async (ctx) => {
    ctx.report({
      success: true,
      outputs: { [ctx.step.id]: { step: { ...ctx.step } } },
    })
  },
}

const plainOutputHandler: HandlerConfig = {
  type: 'plain',
  run: async (ctx) => {
    ctx.report({ success: true, outputs: { value: ctx.step.id, from: 'plain' } })
  },
}

/** Flow step handler that looks up flow from context.flowMap and calls context.run(flow, params). */
const flowHandlerUsingFlowMap: HandlerConfig = {
  type: 'flow',
  run: async (ctx) => {
    if (!ctx.run) {
      ctx.report({ success: false, error: 'no run' })
      return
    }
    const flowId = ctx.step.flow as string
    const flow = ctx.flowMap?.[flowId]
    if (!flow) {
      ctx.report({ success: false, error: 'flow not found', outputs: { [ctx.step.id]: { error: 'flow not found' } } })
      return
    }
    const runResult = await ctx.run(flow, {})
    ctx.report({
      success: runResult.success,
      error: runResult.error,
      outputs: runResult.success ? { merged: true } : { [ctx.step.id]: { error: runResult.error } },
      subSteps: runResult.steps,
    })
  },
}

function createStubRegistry(): Record<string, HandlerConfig> {
  const reg: Record<string, HandlerConfig> = {}
  reg.step = stubHandler
  reg.flow = stubHandler
  return reg
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
    const out = result.steps[0].outputs?.s1 as { step: any }
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

  it('step timeout: executor fails step with timeout error and handler listens to signal', async () => {
    let signalAborted = false
    const hangHandler: HandlerConfig = {
      type: 'hang',
      run: async (ctx) => {
        return new Promise((_, reject) => {
          ctx.signal.addEventListener('abort', () => {
            signalAborted = true
            const err = new Error('step aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      },
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
    expect(signalAborted).toBe(true)
  })

  it('step failure: returns error result for failed step', async () => {
    const failHandler: HandlerConfig = {
      type: 'fail',
      run: async (ctx) => {
        ctx.report({ success: false, error: 'always fail' })
      },
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
    const throwHandler: HandlerConfig = {
      type: 'willThrow',
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
    const { z } = await import('zod')
    const strictHandler: HandlerConfig = {
      type: 'strict',
      schema: z.object({
        run: z.string().min(1),
      }),
      run: async (ctx) => { ctx.report({ success: true }) },
    }
    const reg = createStubRegistry()
    reg.strict = strictHandler
    const flow: FlowDefinition = {
      name: 'validate-fail',
      steps: [{ id: 's1', type: 'strict', dependsOn: [] }],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toContain('Required')
  })

  it('custom registry: passed handler is used', async () => {
    const customHandler: HandlerConfig = {
      type: 'custom',
      run: async (ctx) => {
        ctx.report({ success: true, outputs: { value: (ctx.step as any).payload ?? '' } })
      },
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
    const reg: Record<string, HandlerConfig> = {}
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
    const stepSnapshot = (result.steps[0].outputs as any)?.c1?.step
    expect(stepSnapshot?.run).toBe('echo "x y z"')
  })

  it('executor provides run in step context when running a flow', async () => {
    const flowHandler: HandlerConfig = {
      type: 'flow',
      run: async (ctx) => {
        const hasRun = typeof ctx.run === 'function'
        ctx.report({ success: hasRun, outputs: { [ctx.step.id]: { hasRun } } })
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

  it('executor flattens step result subSteps with prefixed stepId', async () => {
    const flowHandler: HandlerConfig = {
      type: 'flow',
      run: async (ctx) => {
        const subSteps: StepResult[] = [
          stepResult('a', true, { log: 'step a' }),
          stepResult('b', true, { log: 'step b' }),
        ]
        ctx.report({ success: true, outputs: {}, subSteps })
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
    reg.flow = flowHandlerUsingFlowMap
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
    reg.flow = flowHandlerUsingFlowMap
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
    expect(f1?.success).toBe(false)
    const err = f1?.error || (f1?.outputs as any)?.f1?.error
    expect(err).toBeDefined()
    expect(String(err)).toMatch(/depth exceeded|max flow-call depth/)
  })

  it('engine correctly handles nextSteps: null from a loop step for early termination', async () => {
    const reg = createStubRegistry()
    reg.loop = loopTerminatingStubHandler
    reg.terminator = terminatorSubStepHandler

    const flow: FlowDefinition = {
      name: 'loop-terminator-test',
      steps: [
        { id: 'beforeLoop', type: 'step' },
        {
          id: 'loopStep',
          type: 'loop',
        },
        { id: 'afterLoop', type: 'step', dependsOn: ['loopStep'] },
      ],
    }

    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    const executedStepIds = result.steps.map(s => s.stepId)
    expect(executedStepIds).toContain('beforeLoop')
    expect(executedStepIds).toContain('loopStep')
    expect(executedStepIds).not.toContain('afterLoop')

    const loopStepResult = result.steps.find(s => s.stepId === 'loopStep')
    expect(loopStepResult?.nextSteps).toBeNull()
  })

  it('executeFlow terminates early when a step returns nextSteps: null', async () => {
    const terminatorHandler: HandlerConfig = {
      type: 'terminator',
      run: async (ctx) => {
        ctx.report({ success: true, nextSteps: null })
      },
    }
    const reg = createStubRegistry()
    reg.terminator = terminatorHandler
    const flow: FlowDefinition = {
      name: 'terminate-flow',
      steps: [
        { id: 's1', type: 'step', dependsOn: [] },
        { id: 's2', type: 'terminator', dependsOn: ['s1'] },
        { id: 's3', type: 'step', dependsOn: ['s2'] },
      ],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(true)
    expect(result.steps.map(s => s.stepId)).toEqual(['s1', 's2'])
    expect(result.steps[1].success).toBe(true)
    expect(result.steps[1].nextSteps).toBeNull()
  })

  describe('dynamic branching via nextSteps', () => {
    it('executes only the steps specified in nextSteps array', async () => {
      const routerHandler: HandlerConfig = {
        type: 'router',
        run: async (ctx) => {
          // Only allow 'b' to run
          ctx.report({ success: true, nextSteps: ['b'] })
        },
      }
      const reg = createStubRegistry()
      reg.router = routerHandler
      const flow: FlowDefinition = {
        steps: [
          { id: 'a', type: 'router' },
          { id: 'b', type: 'step', dependsOn: ['a'] },
          { id: 'c', type: 'step', dependsOn: ['a'] },
        ],
      }
      const result = await runEngine(flow, { registry: reg })
      expect(result.success).toBe(true)
      const executedIds = result.steps.map(s => s.stepId)
      expect(executedIds).toContain('b')
      expect(executedIds).not.toContain('c')
    })

    it('propagates dead paths (downstream steps are skipped if their dependency is not in nextSteps)', async () => {
      const routerHandler: HandlerConfig = {
        type: 'router',
        run: async (ctx) => {
          ctx.report({ success: true, nextSteps: ['b'] })
        },
      }
      const reg = createStubRegistry()
      reg.router = routerHandler
      const flow: FlowDefinition = {
        steps: [
          { id: 'a', type: 'router' },
          { id: 'b', type: 'step', dependsOn: ['a'] },
          { id: 'c', type: 'step', dependsOn: ['a'] },
          { id: 'd', type: 'step', dependsOn: ['c'] }, // d depends on c which is skipped
        ],
      }
      const result = await runEngine(flow, { registry: reg })
      expect(result.success).toBe(true)
      const executedIds = result.steps.map(s => s.stepId)
      expect(executedIds).toContain('a')
      expect(executedIds).toContain('b')
      expect(executedIds).not.toContain('c')
      expect(executedIds).not.toContain('d')
    })
  })

  it('runs independent steps in the same wave (concurrency)', async () => {
    let activeSteps = 0
    let maxActiveSteps = 0
    const concurrentHandler: HandlerConfig = {
      type: 'concurrent',
      run: async (ctx) => {
        activeSteps++
        maxActiveSteps = Math.max(maxActiveSteps, activeSteps)
        await new Promise(resolve => setTimeout(resolve, 50))
        activeSteps--
        ctx.report({ success: true })
      },
    }
    const reg = createStubRegistry()
    reg.concurrent = concurrentHandler
    const flow: FlowDefinition = {
      steps: [
        { id: 's1', type: 'concurrent' },
        { id: 's2', type: 'concurrent' },
        { id: 's3', type: 'concurrent' },
      ],
    }
    await runEngine(flow, { registry: reg })
    expect(maxActiveSteps).toBeGreaterThan(1)
  })

  it('aborts other steps in the wave when one step fails', async () => {
    let s2Aborted = false
    const failHandler: HandlerConfig = {
      type: 'fail',
      run: async (ctx) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        ctx.report({ success: false, error: 'failed' })
      },
    }
    const longHandler: HandlerConfig = {
      type: 'long',
      run: async (ctx) => {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            ctx.report({ success: true })
            resolve()
          }, 100)
          ctx.signal.addEventListener('abort', () => {
            s2Aborted = true
            clearTimeout(timeout)
            resolve()
          })
        })
      },
    }
    const reg = createStubRegistry()
    reg.fail = failHandler
    reg.long = longHandler
    const flow: FlowDefinition = {
      steps: [
        { id: 's1', type: 'fail' },
        { id: 's2', type: 'long' },
      ],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.success).toBe(false)
    expect(s2Aborted).toBe(true)
  })

  it('handles multiple report calls and keeps the merged result', async () => {
    const multiReportHandler: HandlerConfig = {
      type: 'multi',
      run: async (ctx) => {
        ctx.report({ success: true, outputs: { first: 1 } })
        ctx.report({ success: true, outputs: { second: 2 } })
      },
    }
    const reg = createStubRegistry()
    reg.multi = multiReportHandler
    const flow: FlowDefinition = {
      steps: [{ id: 's1', type: 'multi' }],
    }
    const result = await runEngine(flow, { registry: reg })
    expect(result.steps[0].outputs).toEqual({ first: 1, second: 2 })
  })

  it('detects circular dependencies and returns error', async () => {
    const flow: FlowDefinition = {
      steps: [
        { id: 's1', type: 'step', dependsOn: ['s2'] },
        { id: 's2', type: 'step', dependsOn: ['s1'] },
      ],
    }
    const result = await runEngine(flow, { registry: createStubRegistry() })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/cycle detected/i)
  })

  describe('continueOnError', () => {
    const failHandler: HandlerConfig = {
      type: 'fail',
      run: async (ctx) => {
        ctx.report({ success: false, error: 'failed' })
      },
    }

    function createRegistry(): Record<string, HandlerConfig> {
      return { fail: failHandler, step: stubHandler }
    }

    it('stops subsequent waves on failure by default', async () => {
      const flow: FlowDefinition = {
        steps: [
          { id: 's1', type: 'fail' },
          { id: 's2', type: 'step', dependsOn: ['s1'] },
        ],
      }
      const result = await runEngine(flow, { registry: createRegistry() })
      expect(result.success).toBe(false)
      expect(result.steps.map(s => s.stepId)).toEqual(['s1'])
    })

    it('continues to subsequent waves when step has continueOnError: true', async () => {
      const flow: FlowDefinition = {
        steps: [
          { id: 's1', type: 'fail', continueOnError: true },
          { id: 's2', type: 'step', dependsOn: ['s1'] },
        ],
      }
      const result = await runEngine(flow, { registry: createRegistry() })
      expect(result.success).toBe(false)
      expect(result.steps.map(s => s.stepId)).toEqual(['s1', 's2'])
    })

    it('continues to subsequent waves when global continueOnError: true is set', async () => {
      const flow: FlowDefinition = {
        steps: [
          { id: 's1', type: 'fail' },
          { id: 's2', type: 'step', dependsOn: ['s1'] },
        ],
      }
      const result = await runEngine(flow, { registry: createRegistry(), continueOnError: true })
      expect(result.success).toBe(false)
      expect(result.steps.map(s => s.stepId)).toEqual(['s1', 's2'])
    })

    it('stops when step has continueOnError: false even if global continueOnError: true', async () => {
      const flow: FlowDefinition = {
        steps: [
          { id: 's1', type: 'fail', continueOnError: false },
          { id: 's2', type: 'step', dependsOn: ['s1'] },
        ],
      }
      const result = await runEngine(flow, { registry: createRegistry(), continueOnError: true })
      expect(result.success).toBe(false)
      expect(result.steps.map(s => s.stepId)).toEqual(['s1'])
    })
  })

  describe('hooks', () => {
    const hookStubHandler: HandlerConfig = {
      type: 'step',
      run: async (ctx) => {
        ctx.report({ success: true, outputs: { val: 1 } })
      },
    }

    const hookRegistry = { step: hookStubHandler }

    it('triggers onFlowStart and onFlowComplete', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const onFlowStart = vi.fn()
      const onFlowComplete = vi.fn()

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onFlowStart,
        onFlowComplete,
      })

      expect(onFlowStart).toHaveBeenCalledWith(flow, {})
      expect(onFlowComplete).toHaveBeenCalledWith(result)
    })

    it('triggers onStepStart and onStepComplete', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const onStepStart = vi.fn()
      const onStepComplete = vi.fn()

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onStepStart,
        onStepComplete,
      })

      expect(onStepStart).toHaveBeenCalledWith('s1', expect.objectContaining({ id: 's1' }))
      expect(onStepComplete).toHaveBeenCalledWith('s1', result.steps[0])
    })

    it('does not block flow if a hook throws an error', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const onStepStart = vi.fn().mockImplementation(() => {
        throw new Error('hook error')
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onStepStart,
      })

      expect(result.success).toBe(true)
      expect(onStepStart).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith('Error in flow hook:', expect.any(Error))

      consoleSpy.mockRestore()
    })

    it('triggers onFlowComplete even if flow fails early (e.g. topological sort failure)', async () => {
      const flow: FlowDefinition = {
        steps: [
          { id: 's1', type: 'step', dependsOn: ['s2'] },
          { id: 's2', type: 'step', dependsOn: ['s1'] }, // circular dependency
        ],
      }
      const onFlowComplete = vi.fn()

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onFlowComplete,
      })

      expect(result.success).toBe(false)
      expect(onFlowComplete).toHaveBeenCalledWith(result)
    })

    it('triggers hooks in dryRun mode', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const onFlowStart = vi.fn()
      const onFlowComplete = vi.fn()

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onFlowStart,
        onFlowComplete,
        dryRun: true,
      })

      expect(result.success).toBe(true)
      expect(onFlowStart).toHaveBeenCalled()
      expect(onFlowComplete).toHaveBeenCalled()
    })

    it('supports multiple hooks as an array', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const h1 = vi.fn()
      const h2 = vi.fn()

      await runEngine(flow, {
        registry: hookRegistry,
        onFlowStart: [h1, h2],
      })

      expect(h1).toHaveBeenCalled()
      expect(h2).toHaveBeenCalled()
    })

    it('handles async hooks without blocking (non-blocking verification)', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }

      let hookCompleted = false
      const asyncHook = async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        hookCompleted = true
      }

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onFlowStart: asyncHook,
      })

      expect(result.success).toBe(true)
      // The hook should still be running or just finished, but executeFlow should not have waited for it
      expect(hookCompleted).toBe(false)

      // Cleanup/wait for the hook to finish to avoid leaking
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(hookCompleted).toBe(true)
    })

    it('isolates errors from other hooks in an array', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const h1 = vi.fn().mockImplementation(() => {
        throw new Error('hook 1 error')
      })
      const h2 = vi.fn()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await runEngine(flow, {
        registry: hookRegistry,
        onFlowStart: [h1, h2],
      })

      expect(result.success).toBe(true)
      expect(h1).toHaveBeenCalled()
      expect(h2).toHaveBeenCalled() // Second hook still called
      expect(consoleSpy).toHaveBeenCalledWith('Error in flow hook:', expect.any(Error))

      consoleSpy.mockRestore()
    })

    it('handles async hook rejections without crashing', async () => {
      const flow: FlowDefinition = {
        steps: [{ id: 's1', type: 'step', dependsOn: [] }],
      }
      const asyncHook = async () => {
        throw new Error('async hook error')
      }
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await runEngine(flow, {
        registry: hookRegistry,
        onFlowStart: asyncHook,
      })

      // We need to wait a bit for the async rejection to be caught
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(consoleSpy).toHaveBeenCalledWith('Error in flow hook (async):', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })
})
