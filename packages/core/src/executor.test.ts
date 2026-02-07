import type { FlowDefinition } from './types'
import { describe, expect, it } from 'vitest'
import { run } from './executor'

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
})
