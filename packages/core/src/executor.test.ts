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
    expect(result.steps[0].outputs).toEqual({ seen: '1' })
  })

  it('js step returns object → StepResult.outputs set and next step context includes it', async () => {
    const flow: FlowDefinition = {
      name: 'output-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { x: 1 }', dependsOn: [] },
        { id: 'j2', type: 'js', run: 'return { y: params.x }', dependsOn: ['j1'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ x: 1 })
    expect(result.steps[1].outputs).toEqual({ y: 1 })
  })

  it('context accumulation: step1 returns, step2 sees it and returns, step3 sees both', async () => {
    const flow: FlowDefinition = {
      name: 'accum-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { a: "s1" }', dependsOn: [] },
        { id: 'j2', type: 'js', run: 'return { b: "s2", from1: params.a }', dependsOn: ['j1'] },
        { id: 'j3', type: 'js', run: 'return { from1: params.a, from2: params.b }', dependsOn: ['j2'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[1].outputs).toEqual({ b: 's2', from1: 's1' })
    expect(result.steps[2].outputs).toEqual({ from1: 's1', from2: 's2' })
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
    expect(result.steps[0].outputs).toEqual({ ok: true })
  })

  it('js step returns non-object or no return: no outputs', async () => {
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
    expect(result.steps[0].outputs).toBeUndefined()
    expect(result.steps[1].outputs).toBeUndefined()
    expect(result.steps[2].outputs).toBeUndefined()
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
    expect(result.steps[0].outputs).toEqual({ seen: 'x' })
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
    expect(result.steps[0].outputs).toEqual({ fromFile: true })
  })

  it('js step with file but no flowFilePath: step fails', async () => {
    const flow: FlowDefinition = {
      name: 'no-path',
      steps: [
        { id: 'j1', type: 'js', run: '', file: 'step.js', dependsOn: [] },
      ],
    }
    const result = await run(flow, {})
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('flowFilePath')
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

  it('http step with 4xx: success false, no outputs', async () => {
    const flow: FlowDefinition = {
      name: 'http-4xx',
      steps: [
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/status/404', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].outputs).toBeUndefined()
  })

  it('http step: substitution applied to url', async () => {
    const flow: FlowDefinition = {
      name: 'http-subst',
      steps: [
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/{{ path }}', dependsOn: [] },
      ],
    }
    const result = await run(flow, { params: { path: 'json' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs?.fetch).toBeDefined()
    const resp = result.steps[0].outputs!.fetch as { statusCode: number }
    expect(resp.statusCode).toBe(200)
  })

  it('http step: output key is step id when output omitted', async () => {
    const flow: FlowDefinition = {
      name: 'http-default-key',
      steps: [
        { id: 'myFetch', type: 'http', url: 'https://httpbin.org/json', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.steps[0].outputs?.myFetch).toBeDefined()
    expect(result.steps[0].outputs?.fetch).toBeUndefined()
  })

  it('http step: output key is step.outputKey when provided', async () => {
    const flow: FlowDefinition = {
      name: 'http-custom-key',
      steps: [
        { id: 'x', type: 'http', url: 'https://httpbin.org/json', outputKey: 'apiResult', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.steps[0].outputs?.apiResult).toBeDefined()
    expect(result.steps[0].outputs?.x).toBeUndefined()
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
    expect(result.steps[2].outputs).toEqual({ status: 200, hasBody: true })
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
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].stepId).toBe('check')
    expect(result.steps[1].stepId).toBe('onFalse')
    expect(result.steps[1].stdout.trim()).toBe('else')
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
    expect(result.steps[1].outputs?.hasResult).toBe(false)
  })

  it('condition missing when fails with error', async () => {
    const flow: FlowDefinition = {
      name: 'cond-no-when',
      steps: [
        { id: 'c', type: 'condition', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('when')
  })

  it('condition when evaluation throws returns error result', async () => {
    const flow: FlowDefinition = {
      name: 'cond-eval-error',
      steps: [
        { id: 'c', type: 'condition', when: 'params.missing.foo', then: 'x', else: 'y', dependsOn: [] },
        { id: 'x', type: 'command', run: 'echo x', dependsOn: ['c'] },
        { id: 'y', type: 'command', run: 'echo y', dependsOn: ['c'] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toBeDefined()
  })

  it('condition without then and else fails validation', async () => {
    const flow: FlowDefinition = {
      name: 'cond-no-then-else',
      steps: [
        { id: 'c', type: 'condition', when: 'true', dependsOn: [] },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('then')
    expect(result.steps[0].error).toContain('else')
  })
})
