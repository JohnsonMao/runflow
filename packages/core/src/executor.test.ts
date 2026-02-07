import type { FlowDefinition } from './types'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { run } from './executor'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('run', () => {
  it('dryRun returns success without executing', () => {
    const flow: FlowDefinition = {
      name: 'dry',
      steps: [
        { id: 's1', type: 'command', run: 'exit 1' },
      ],
    }
    const result = run(flow, { dryRun: true })
    expect(result.flowName).toBe('dry')
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].stdout).toBe('')
  })

  it('runs command step and captures stdout', () => {
    const flow: FlowDefinition = {
      name: 'echo-flow',
      steps: [
        { id: 's1', type: 'command', run: 'echo hello' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('hello')
    expect(result.steps[0].stderr).toBe('')
  })

  it('reports failure when command exits non-zero', () => {
    const flow: FlowDefinition = {
      name: 'fail-flow',
      steps: [
        { id: 's1', type: 'command', run: 'exit 42' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toBeDefined()
  })

  it('runs multiple steps in order', () => {
    const flow: FlowDefinition = {
      name: 'multi',
      steps: [
        { id: 'a', type: 'command', run: 'echo first' },
        { id: 'b', type: 'command', run: 'echo second' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('first')
    expect(result.steps[1].stdout.trim()).toBe('second')
  })

  it('runs js step and captures console.log', () => {
    const flow: FlowDefinition = {
      name: 'js-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'console.log(1 + 1)' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('2')
  })

  it('reports failure when js step throws', () => {
    const flow: FlowDefinition = {
      name: 'js-fail',
      steps: [
        { id: 'j1', type: 'js', run: 'throw new Error("expected")' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('expected')
  })

  it('runs mixed command and js steps in order', () => {
    const flow: FlowDefinition = {
      name: 'mixed',
      steps: [
        { id: 'c1', type: 'command', run: 'echo from-shell' },
        { id: 'j1', type: 'js', run: 'console.log("from-js")' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('from-shell')
    expect(result.steps[1].stdout.trim()).toBe('from-js')
  })

  it('run with params: first step (js) sees params.a', () => {
    const flow: FlowDefinition = {
      name: 'params-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { seen: params.a }' },
      ],
    }
    const result = run(flow, { params: { a: '1' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ seen: '1' })
  })

  it('js step returns object → StepResult.outputs set and next step context includes it', () => {
    const flow: FlowDefinition = {
      name: 'output-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { x: 1 }' },
        { id: 'j2', type: 'js', run: 'return { y: params.x }' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ x: 1 })
    expect(result.steps[1].outputs).toEqual({ y: 1 })
  })

  it('context accumulation: step1 returns, step2 sees it and returns, step3 sees both', () => {
    const flow: FlowDefinition = {
      name: 'accum-flow',
      steps: [
        { id: 'j1', type: 'js', run: 'return { a: "s1" }' },
        { id: 'j2', type: 'js', run: 'return { b: "s2", from1: params.a }' },
        { id: 'j3', type: 'js', run: 'return { from1: params.a, from2: params.b }' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[1].outputs).toEqual({ b: 's2', from1: 's1' })
    expect(result.steps[2].outputs).toEqual({ from1: 's1', from2: 's2' })
  })

  it('run without params: context empty, existing behavior unchanged', () => {
    const flow: FlowDefinition = {
      name: 'no-params',
      steps: [
        { id: 'j1', type: 'js', run: 'return typeof params !== "undefined" && Object.keys(params).length === 0 ? { ok: true } : {}' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ ok: true })
  })

  it('js step returns non-object or no return: no outputs', () => {
    const flow: FlowDefinition = {
      name: 'no-outputs',
      steps: [
        { id: 'j1', type: 'js', run: 'return 42' },
        { id: 'j2', type: 'js', run: 'console.log("no return")' },
        { id: 'j3', type: 'js', run: 'return params.x' },
      ],
    }
    const result = run(flow)
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toBeUndefined()
    expect(result.steps[1].outputs).toBeUndefined()
    expect(result.steps[2].outputs).toBeUndefined()
  })

  it('flow with params declaration: run with valid params passes validation and steps see context', () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'a', type: 'string', required: true }],
      steps: [
        { id: 'j1', type: 'js', run: 'return { seen: params.a }' },
      ],
    }
    const result = run(flow, { params: { a: 'x' } })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ seen: 'x' })
  })

  it('run with missing required param: validation fails before any step', () => {
    const flow: FlowDefinition = {
      name: 'decl',
      params: [{ name: 'a', type: 'string', required: true }],
      steps: [{ id: 's1', type: 'command', run: 'echo hi' }],
    }
    const result = run(flow, {})
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(0)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('a')
  })

  it('command step: template substitution for {{ a }}, {{ obj.b }}, {{ arr[0] }}', () => {
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
    const result = run(flow, {
      params: { a: 'x', obj: { b: 'y' }, arr: ['z'] },
    })
    expect(result.success).toBe(true)
    expect(result.steps[0].stdout.trim()).toBe('x y z')
  })

  it('js step with file: loads and runs file, outputs merged into context', () => {
    const flowFilePath = path.join(__dirname, 'fixtures', 'flow.yaml')
    const flow: FlowDefinition = {
      name: 'file-js',
      steps: [
        { id: 'j1', type: 'js', run: '', file: 'step.js' },
      ],
    }
    const result = run(flow, { flowFilePath })
    expect(result.success).toBe(true)
    expect(result.steps[0].outputs).toEqual({ fromFile: true })
  })

  it('js step with file but no flowFilePath: step fails', () => {
    const flow: FlowDefinition = {
      name: 'no-path',
      steps: [
        { id: 'j1', type: 'js', run: '', file: 'step.js' },
      ],
    }
    const result = run(flow, {})
    expect(result.success).toBe(false)
    expect(result.steps[0].success).toBe(false)
    expect(result.steps[0].error).toContain('flowFilePath')
  })
})
