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
        { id: 's1', type: 'command', run: 'exit 1' },
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
        { id: 's1', type: 'command', run: 'echo hello' },
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
        { id: 's1', type: 'command', run: 'exit 42' },
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
        { id: 'a', type: 'command', run: 'echo first' },
        { id: 'b', type: 'command', run: 'echo second' },
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
        { id: 'j1', type: 'js', run: 'console.log(1 + 1)' },
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
        { id: 'j1', type: 'js', run: 'throw new Error("expected")' },
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
        { id: 'c1', type: 'command', run: 'echo from-shell' },
        { id: 'j1', type: 'js', run: 'console.log("from-js")' },
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
        { id: 'j1', type: 'js', run: 'return { seen: params.a }' },
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
        { id: 'j1', type: 'js', run: 'return { x: 1 }' },
        { id: 'j2', type: 'js', run: 'return { y: params.x }' },
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
        { id: 'j1', type: 'js', run: 'return { a: "s1" }' },
        { id: 'j2', type: 'js', run: 'return { b: "s2", from1: params.a }' },
        { id: 'j3', type: 'js', run: 'return { from1: params.a, from2: params.b }' },
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
        { id: 'j1', type: 'js', run: 'return typeof params !== "undefined" && Object.keys(params).length === 0 ? { ok: true } : {}' },
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
        { id: 'j1', type: 'js', run: 'return 42' },
        { id: 'j2', type: 'js', run: 'console.log("no return")' },
        { id: 'j3', type: 'js', run: 'return params.x' },
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
        { id: 'j1', type: 'js', run: 'return { seen: params.a }' },
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
      steps: [{ id: 's1', type: 'command', run: 'echo hi' }],
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
        { id: 'j1', type: 'js', run: '', file: 'step.js' },
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
        { id: 'j1', type: 'js', run: '', file: 'step.js' },
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
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/json' },
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

  it('http step with 4xx and allowErrorStatus false: success false, no outputs', async () => {
    const flow: FlowDefinition = {
      name: 'http-4xx',
      steps: [
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/status/404' },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].outputs).toBeUndefined()
  })

  it('http step with 4xx and allowErrorStatus true: success false, outputs merged with response', async () => {
    const flow: FlowDefinition = {
      name: 'http-4xx-allow',
      steps: [
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/status/404', allowErrorStatus: true },
      ],
    }
    const result = await run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].outputs?.fetch).toBeDefined()
    const resp = result.steps[0].outputs!.fetch as { statusCode: number }
    expect(resp.statusCode).toBe(404)
  })

  it('http step: substitution applied to url', async () => {
    const flow: FlowDefinition = {
      name: 'http-subst',
      steps: [
        { id: 'fetch', type: 'http', url: 'https://httpbin.org/{{ path }}' },
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
        { id: 'myFetch', type: 'http', url: 'https://httpbin.org/json' },
      ],
    }
    const result = await run(flow)
    expect(result.steps[0].outputs?.myFetch).toBeDefined()
    expect(result.steps[0].outputs?.fetch).toBeUndefined()
  })

  it('http step: output key is step.output when provided', async () => {
    const flow: FlowDefinition = {
      name: 'http-custom-key',
      steps: [
        { id: 'x', type: 'http', url: 'https://httpbin.org/json', output: 'apiResult' },
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
        { id: 'c1', type: 'command', run: 'echo ok' },
        { id: 'h1', type: 'http', url: 'https://httpbin.org/json', output: 'api' },
        { id: 'j1', type: 'js', run: 'return { status: params.api?.statusCode, hasBody: typeof params.api?.body === "object" }' },
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
        { id: 's1', type: 'customType', run: 'echo hi' },
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
        { id: 's1', type: 'command', run: 'echo ok' },
        { id: 's2', type: 'willThrow', run: 'x' },
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
        { id: 'c1', type: 'command', run: 'echo from-default' },
        { id: 's1', type: 'custom', payload: 'hi' },
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
        { id: 's1', type: 'command' },
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
        { id: 's1', type: 'custom', payload: 'hello' },
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
})
