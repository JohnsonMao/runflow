import type { FlowDefinition, FlowStep } from './types'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { run } from './executor'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('run', () => {
  it('dryRun returns success without executing', async () => {
    const flow: FlowDefinition = {
      name: 'dry',
      steps: [
        { id: 's1', type: 'command', run: 'exit 1', dependsOn: [] },
      ],
    }
    const result = await run(flow, { dryRun: true })
    expect(result.flowName).toBe('dry')
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].stdout).toBe('')
  })

  it('runs command step and captures stdout', async () => {
    const flow: FlowDefinition = {
      name: 'echo-flow',
      steps: [
        { id: 's1', type: 'command', run: 'echo hello', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('hello')
    expect(result.steps[0].stderr).toBe('')
  })

  it('reports failure when command exits non-zero', async () => {
    const flow: FlowDefinition = {
      name: 'fail-flow',
      steps: [
        { id: 's1', type: 'command', run: 'exit 42', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toBeDefined()
  })

  it('runs multiple steps in order', async () => {
    const flow: FlowDefinition = {
      name: 'multi',
      steps: [
        { id: 'a', type: 'command', run: 'echo first', dependsOn: [] },
        { id: 'b', type: 'command', run: 'echo second', dependsOn: ['a'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('first')
    expect(result.steps[1].stdout.trim()).toBe('second')
  })

  it('runs js step and captures console.log', async () => {
    const flow: FlowDefinition = {
      name: 'js-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'console.log(1 + 1)', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('2')
  })

  it('reports failure when js step throws', async () => {
    const flow: FlowDefinition = {
      name: 'js-fail',
      steps: [
        { id: 'j1', type: 'js', run: 'throw new Error("expected")', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('expected')
  })

  it('runs mixed command and js steps in order', async () => {
    const flow: FlowDefinition = {
      name: 'mixed',
      steps: [
        { id: 'c1', type: 'command', run: 'echo from-shell', dependsOn: [] },
        { id: 'j1', type: 'js', run: 'console.log("from-js")', dependsOn: ['c1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('from-shell')
    expect(result.steps[1].stdout.trim()).toBe('from-js')
  })

  it('run with params: first step (js) sees params.a', async () => {
    const flow: FlowDefinition = {
      name: 'params-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { seen: params.a }', dependsOn: [] },
      ],
    }
    const result = await run(flow, { params: { a: '1' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { seen: '1' } })
  })

  it('js step returns object → StepResult.outputs under outputKey (step id), next step sees params.j1.x', async () => {
    const flow: FlowDefinition = {
      name: 'output-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { x: 1 }', dependsOn: [] },
        { id: 'j2', type: 'js', run: 'return { y: params.j1.x }', dependsOn: ['j1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { x: 1 } })
    expect(result.steps[1].outputs).toEqual({ j2: { y: 1 } })
  })

  it('context accumulation: step1 returns, step2 sees it and returns, step3 sees both', async () => {
    const flow: FlowDefinition = {
      name: 'accum-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { a: "s1" }', dependsOn: [] },
        { id: 'j2', type: 'js', run: 'return { b: "s2", from1: params.j1.a }', dependsOn: ['j1'] },
        { id: 'j3', type: 'js', run: 'return { from1: params.j1.a, from2: params.j2.b }', dependsOn: ['j2'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[1].outputs).toEqual({ j2: { b: 's2', from1: 's1' } })
    expect(result.steps[2].outputs).toEqual({ j3: { from1: 's1', from2: 's2' } })
  })

  it('run without params: context empty, existing behavior unchanged', async () => {
    const flow: FlowDefinition = {
      name: 'no-params',
      steps: [
        { id: 'j1', type: 'js', run: 'return typeof params !== "undefined" && Object.keys(params).length === 0 ? { ok: true } : {}', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { ok: true } })
  })

  it('js step returns non-object: single output under outputKey (step id when omitted)', async () => {
    const flow: FlowDefinition = {
      name: 'no-outputs',
      steps: [
        { id: 'j1', type: 'js', run: 'return 42', dependsOn: [] },
        { id: 'j2', type: 'js', run: 'console.log("no return")', dependsOn: ['j1'] },
        { id: 'j3', type: 'js', run: 'return params.x', dependsOn: ['j2'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: 42 })
    expect(result.steps[1].outputs).toEqual({ j2: undefined })
    expect(result.steps[2].outputs).toEqual({ j3: undefined })
  })

  it('flow with params declaration: run with valid params passes validation and steps see context', async () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'a', type: 'string', required: true }],
      steps: [
        { id: 'j1', type: 'js', run: 'return { seen: params.a }', dependsOn: [] },
      ],
    }
    const result = await run(flow, { params: { a: 'x' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { seen: 'x' } })
  })

  it('run with missing required param: validation fails before any step', async () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'a', type: 'string', required: true }],
      steps: [{ id: 's1', type: 'command', run: 'echo hi', dependsOn: [] }],
    }
    const result = await run(flow, {})
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('a')
  })

  it('command step: template substitution for {{ a }}, {{ obj.b }}, {{ arr[0] }}', async () => {
    const flow: FlowDefinition = {
      name: 'subst',
      steps: [
        {
          id: 'c1',
          type: 'command',
          run: 'echo "{{ a }} {{ obj.b }} {{ arr[0] }}"',
          dependsOn: [],
        },
      ],
    }
    const result = await run(flow, {
      params: { a: 'x', obj: { b: 'y' }, arr: ['z'] },
    })
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('x y z')
  })

  it('step when false: step skipped, success result pushed, dependents run', async () => {
    const flow: FlowDefinition = {
      name: 'when-skip',
      steps: [
        { id: 'a', type: 'command', run: 'echo a', dependsOn: [] },
        { id: 'b', type: 'command', run: 'echo b', when: 'params.skip === true', dependsOn: ['a'] },
        { id: 'c', type: 'js', run: 'return { fromA: params.a }', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow, { params: { skip: false, a: 'from-param' } })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(3)
    expect(result.steps[0].stdout.trim()).toBe('a')
    expect(result.steps[1].success).toBe(true)
    expect(result.steps[1].stdout).toBe('')
    expect(result.steps[1].outputs).toBeUndefined()
    expect(result.steps[2].outputs).toEqual({ c: { fromA: 'from-param' } })
  })

  it('step when true: step runs', async () => {
    const flow: FlowDefinition = {
      name: 'when-run',
      steps: [
        { id: 'j1', type: 'js', run: 'return { x: 1 }', when: 'params.run === true', dependsOn: [] },
      ],
    }
    const result = await run(flow, { params: { run: true } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { x: 1 } })
  })

  it('step timeout: step fails with timeout error', async () => {
    const flow: FlowDefinition = {
      name: 'step-timeout',
      steps: [
        { id: 'j1', type: 'js', run: 'while(true){}', timeout: 1, dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toMatch(/timeout|timed out/i)
  })

  it('step retry: success on first run, no retry', async () => {
    const flow: FlowDefinition = {
      name: 'retry-ok',
      steps: [
        { id: 'j1', type: 'js', run: 'return { ok: true }', retry: 2, dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { ok: true } })
  })

  it('step retry: fails after all attempts', async () => {
    const flow: FlowDefinition = {
      name: 'retry-fail',
      steps: [
        { id: 'j1', type: 'js', run: 'throw new Error("always fail")', retry: 2, dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('always fail')
  })

  it('js step with file: loads and runs file, outputs merged into context', async () => {
    const flowFilePath = path.join(__dirname, 'fixtures', 'flow.yaml')
    const flow: FlowDefinition = {
      name: 'file-js',
      steps: [
        { id: 'j1', type: 'js', run: '', file: 'step.js', dependsOn: [] },
      ],
    }
    const result = await run(flow, { flowFilePath })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ j1: { fromFile: true } })
  })

  it('http step with 2xx: success true, outputs under outputKey, body parsed when JSON', async () => {
    const flow: FlowDefinition = {
      name: 'http-flow',
      steps: [
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/json', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].outputs).toBeDefined()
    expect(result.steps[0].outputs?.fetch).toBeDefined()
    const resp = result.steps[0].outputs!.fetch as { statusCode: number, body: unknown }
    expect(resp.statusCode).toBe(200)
    expect(typeof resp.body).toBe('object')
    expect(resp.body).not.toBeNull()
  })

  it('flow with command + http + js: http response visible in next step context', async () => {
    const flow: FlowDefinition = {
      name: 'mixed-http',
      steps: [
        { id: 'c1', type: 'command', run: 'echo ok', dependsOn: [] },
        { id: 'h1', type: 'http', url: 'https://httpbin.org/json', outputKey: 'api', dependsOn: ['c1'] },
        { id: 'j1', type: 'js', run: 'return { status: params.api?.statusCode, hasBody: typeof params.api?.body === "object" }', dependsOn: ['h1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[2].outputs).toEqual({ j1: { status: 200, hasBody: true } })
  })

  it('sleep step with seconds: waits then success, no outputs', async () => {
    const flow: FlowDefinition = {
      name: 'sleep-sec',
      steps: [
        { id: 'wait', type: 'sleep', seconds: 0, dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].outputs).toBeUndefined()
  })

  it('set step: outputs merged into context, downstream sees keys', async () => {
    const flow: FlowDefinition = {
      name: 'set-flow',
      steps: [
        { id: 's1', type: 'set', set: { flag: true, n: 42 }, dependsOn: [] },
        { id: 'j1', type: 'js', run: 'return { seen: params.flag, num: params.n }', dependsOn: ['s1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ flag: true, n: 42 })
    expect(result.steps[1].outputs).toEqual({ j1: { seen: true, num: 42 } })
  })

  it('set step with template: executor substitutes before handler', async () => {
    const flow: FlowDefinition = {
      name: 'set-subst',
      steps: [
        { id: 'a', type: 'set', set: { x: 1 }, dependsOn: [] },
        { id: 'b', type: 'set', set: { sum: '{{ x }}-{{ y }}' }, dependsOn: ['a'] },
        { id: 'c', type: 'js', run: 'return { result: params.sum }', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow, { params: { y: 2 } })
    expect(result.success).toBe(true)
    expect(result.steps[2].outputs).toEqual({ c: { result: '1-2' } })
  })

  it('set step without set field: fails validation or run', async () => {
    const flow: FlowDefinition = {
      name: 'set-missing',
      steps: [
        { id: 's1', type: 'set', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
  })

  it('loop step with body and done: runs body per item then returns nextSteps: done', async () => {
    const flow: FlowDefinition = {
      name: 'loop-branches',
      steps: [
        { id: 'l1', type: 'loop', items: [1, 2, 3], body: ['body'], done: ['after'], dependsOn: [] },
        { id: 'body', type: 'set', set: { lastItem: '{{ item }}', idx: '{{ index }}' }, dependsOn: ['l1'] },
        { id: 'after', type: 'js', run: 'return { count: (params.items ?? []).length }', outputKey: 'finalCount', dependsOn: ['l1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(5)
    expect(result.steps[0].stepId).toBe('body')
    expect(result.steps[1].stepId).toBe('body')
    expect(result.steps[2].stepId).toBe('body')
    expect(result.steps[3].stepId).toBe('l1')
    expect(result.steps[3].nextSteps).toEqual(['after'])
    expect(result.steps[4].stepId).toBe('after')
    expect(result.steps[3].outputs).toMatchObject({ count: 3, items: [1, 2, 3] })
    expect(result.steps[4].outputs?.finalCount).toEqual({ count: 3 })
  })

  it('loop step with count: runs body N times then nextSteps: done', async () => {
    const flow: FlowDefinition = {
      name: 'loop-count',
      steps: [
        { id: 'l1', type: 'loop', count: 2, body: ['body'], done: ['after'], dependsOn: [] },
        { id: 'body', type: 'set', set: { iteration: '{{ index }}' }, dependsOn: ['l1'] },
        { id: 'after', type: 'js', run: 'return params.iteration', outputKey: 'lastIteration', dependsOn: ['l1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps.filter(s => s.stepId === 'body')).toHaveLength(2)
    const loopResult = result.steps.find(s => s.stepId === 'l1')
    expect(loopResult?.nextSteps).toEqual(['after'])
    expect(loopResult?.outputs).toMatchObject({ count: 2 })
    const afterResult = result.steps.find(s => s.stepId === 'after')
    expect(afterResult?.outputs?.lastIteration).toBe('1')
  })

  it('unknown step type: returns error result and continues', async () => {
    const flow: FlowDefinition = {
      name: 'unknown-type',
      steps: [
        { id: 's1', type: 'customType', run: 'echo hi', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('Unknown step type')
    expect(result.steps[0].error).toContain('customType')
  })

  it('handler that throws: executor catches and returns error result', async () => {
    const flow: FlowDefinition = {
      name: 'throw-flow',
      steps: [
        { id: 's1', type: 'command', run: 'echo ok', dependsOn: [] },
        { id: 's2', type: 'willThrow', run: 'x', dependsOn: ['s1'] },
      ],
    }
    const defaultReg = (await import('./registry')).createDefaultRegistry()
    const registry = {
      ...defaultReg,
      willThrow: {
        run: async () => {
          throw new Error('handler threw')
        },
      },
    }
    const result = await run(flow, { registry })
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[1].success).toBe(false)
    expect(result.steps[1].error).toContain('handler threw')
  })

  it('registry merge: default handlers remain when passing custom registry', async () => {
    const flow: FlowDefinition = {
      name: 'merged',
      steps: [
        { id: 'c1', type: 'command', run: 'echo from-default', dependsOn: [] },
        { id: 's1', type: 'custom', payload: 'hi', dependsOn: ['c1'] },
      ],
    }
    const customOnly = {
      custom: {
        run: async (step: FlowStep) => ({
          stepId: step.id,
          success: true,
          stdout: '',
          stderr: '',
          outputs: { v: (step.payload as string) ?? '' },
        }),
      },
    }
    const result = await run(flow, { registry: customOnly })
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('from-default')
    expect(result.steps[1].outputs).toEqual({ v: 'hi' })
  })

  it('handler validate: command step without run fails with validation message', async () => {
    const flow: FlowDefinition = {
      name: 'no-run',
      steps: [
        { id: 's1', type: 'command', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toContain('command step requires run')
  })

  it('custom registry: custom handler is used when passed', async () => {
    const flow: FlowDefinition = {
      name: 'custom-reg',
      steps: [
        { id: 's1', type: 'custom', payload: 'hello', dependsOn: [] },
      ],
    }
    const defaultRegistry = (await import('./registry')).createDefaultRegistry()
    const registry = {
      ...defaultRegistry,
      custom: {
        run: async (step: FlowStep) => ({
          stepId: step.id,
          success: true,
          stdout: '',
          stderr: '',
          outputs: { value: (step.payload as string) ?? '' },
        }),
      },
    }
    const result = await run(flow, { registry })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ value: 'hello' })
  })

  it('dag linear chain executes in dependency order', async () => {
    const flow: FlowDefinition = {
      name: 'linear-dag',
      steps: [
        { id: 'a', type: 'command', run: 'echo A', dependsOn: [] },
        { id: 'b', type: 'command', run: 'echo B', dependsOn: ['a'] },
        { id: 'c', type: 'command', run: 'echo C', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps.map(s => s.stepId)).toEqual(['a', 'b', 'c'])
    expect(result.steps[0].stdout.trim()).toBe('A')
    expect(result.steps[1].stdout.trim()).toBe('B')
    expect(result.steps[2].stdout.trim()).toBe('C')
  })

  it('dag orphan steps are excluded from execution', async () => {
    const flow: FlowDefinition = {
      name: 'with-orphan',
      steps: [
        { id: 'root', type: 'command', run: 'echo only', dependsOn: [] },
        { id: 'orphan', type: 'command', run: 'echo never' },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].stepId).toBe('root')
    expect(result.steps[0].stdout.trim()).toBe('only')
  })

  it('dag cycle returns error and no steps', async () => {
    const flow: FlowDefinition = {
      name: 'cycle',
      steps: [
        { id: 'a', type: 'command', run: 'echo a', dependsOn: ['c'] },
        { id: 'b', type: 'command', run: 'echo b', dependsOn: ['a'] },
        { id: 'c', type: 'command', run: 'echo c', dependsOn: ['b'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toContain('Cycle')
  })

  it('dag dependency on orphan returns error', async () => {
    const flow: FlowDefinition = {
      name: 'dep-on-orphan',
      steps: [
        { id: 'orphan', type: 'command', run: 'x' },
        { id: 'b', type: 'command', run: 'echo b', dependsOn: ['orphan'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toMatch(/not in the DAG|orphan/)
  })

  it('condition when true returns result true and only then-branch runs', async () => {
    const flow: FlowDefinition = {
      name: 'cond-then',
      steps: [
        { id: 'check', type: 'condition', when: 'params.flag === true', then: 'onTrue', else: 'onFalse', dependsOn: [] },
        { id: 'onTrue', type: 'command', run: 'echo then', dependsOn: ['check'] },
        { id: 'onFalse', type: 'command', run: 'echo else', dependsOn: ['check'] },
      ],
    }
    const result = await run(flow, { params: { flag: true } })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].stepId).toBe('check')
    expect(result.steps[1].stepId).toBe('onTrue')
    expect(result.steps[1].stdout.trim()).toBe('then')
  })

  it('condition when false returns result false and only else-branch runs', async () => {
    const flow: FlowDefinition = {
      name: 'cond-else',
      steps: [
        { id: 'check', type: 'condition', when: 'params.flag === true', then: 'onTrue', else: 'onFalse', dependsOn: [] },
        { id: 'onTrue', type: 'command', run: 'echo then', dependsOn: ['check'] },
        { id: 'onFalse', type: 'command', run: 'echo else', dependsOn: ['check'] },
      ],
    }
    const result = await run(flow, { params: { flag: false } })
    expect(result.success).toBe(true)
    expect(result.steps.length).toBeGreaterThanOrEqual(2)
    expect(result.steps[0].stepId).toBe('check')
    const onFalseResult = result.steps.find(s => s.stepId === 'onFalse')
    expect(onFalseResult).toBeDefined()
    expect(onFalseResult!.stdout.trim()).toBe('else')
  })

  it('condition result is not merged into context for downstream steps', async () => {
    const flow: FlowDefinition = {
      name: 'cond-no-pollution',
      steps: [
        { id: 'check', type: 'condition', when: 'true', then: 'next', dependsOn: [] },
        { id: 'next', type: 'js', run: 'return { hasResult: "result" in params }', dependsOn: ['check'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[1].outputs?.next).toEqual({ hasResult: false })
  })

  describe('flow step', () => {
    const fixturesDir = path.join(__dirname, 'fixtures')
    const flowFilePath = path.join(fixturesDir, 'main.yaml')

    it('runs callee flow from relative path and merges outputs; next step sees context', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow.yaml', dependsOn: [] },
          { id: 'j1', type: 'js', run: 'return { seen: params.s1?.fromSub, n: params.s1?.n }', dependsOn: ['f1'] },
        ],
      }
      const result = await run(flow, { flowFilePath })
      expect(result.success).toBe(true)
      expect(result.steps[0].success).toBe(true)
      expect(result.steps[0].outputs).toEqual({ s1: { fromSub: true, n: 1 } })
      expect(result.steps[1].outputs?.j1).toEqual({ seen: true, n: 1 })
    })

    it('resolves relative path from flowFilePath dir', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow.yaml', dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath: path.join(fixturesDir, 'main.yaml') })
      expect(result.success).toBe(true)
      expect(result.steps[0].outputs).toEqual({ s1: { fromSub: true, n: 1 } })
    })

    it('returns failure when callee file is missing', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'nonexistent.yaml', dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath })
      expect(result.success).toBe(false)
      expect(result.steps[0].success).toBe(false)
      expect(result.steps[0].error).toMatch(/not found|failed to load/i)
    })

    it('max flow-call depth: second level fails with depth exceeded', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow2.yaml', dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath, maxFlowCallDepth: 1 })
      expect(result.success).toBe(false)
      const f1Result = result.steps.find(s => s.stepId === 'f1')
      expect(f1Result).toBeDefined()
      expect(f1Result!.success).toBe(false)
      expect(f1Result!.error).toMatch(/depth exceeded|max flow-call depth/i)
    })

    it('max flow-call depth: one level allowed with maxFlowCallDepth 1', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow.yaml', dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath, maxFlowCallDepth: 1 })
      expect(result.success).toBe(true)
      expect(result.steps[0].outputs).toEqual({ s1: { fromSub: true, n: 1 } })
    })

    it('callee with params declaration: valid params pass', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow-with-params.yaml', params: { a: 'valid' }, dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath })
      expect(result.success).toBe(true)
      expect(result.steps[0].outputs).toEqual({ j1: { received: 'valid' } })
    })

    it('callee with params declaration: invalid params yield StepResult failure with validation error', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow-with-params.yaml', params: {}, dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath })
      expect(result.success).toBe(false)
      expect(result.steps[0].success).toBe(false)
      expect(result.steps[0].error).toMatch(/required|a/i)
    })

    it('flow step passes params to callee', async () => {
      const flow: FlowDefinition = {
        name: 'caller',
        steps: [
          { id: 'f1', type: 'flow', flow: 'subflow.yaml', params: { fromCaller: 42 }, dependsOn: [] },
        ],
      }
      const result = await run(flow, { flowFilePath })
      expect(result.success).toBe(true)
      expect(result.steps[0].outputs).toEqual({ s1: { fromSub: true, n: 1 } })
    })
  })
})
