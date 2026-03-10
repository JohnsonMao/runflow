import type { FlowDefinition, RunOptions } from './types'
import { describe, expect, it, vi } from 'vitest'
import { executeFlow } from './engine'
import { run } from './run'

describe('executeFlow hooks', () => {
  const stubHandler = {
    type: 'step',
    run: async (ctx: any) => {
      ctx.report({ success: true, outputs: { val: 1 } })
    },
  }

  const registry = { step: stubHandler }

  it('triggers onFlowStart and onFlowComplete', async () => {
    const flow: FlowDefinition = {
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const onFlowStart = vi.fn()
    const onFlowComplete = vi.fn()

    const options: RunOptions = {
      registry,
      onFlowStart,
      onFlowComplete,
    }

    const result = await executeFlow(flow, options, {}, run)

    expect(onFlowStart).toHaveBeenCalledWith(flow, {})
    expect(onFlowComplete).toHaveBeenCalledWith(result)
  })

  it('triggers onStepStart and onStepComplete', async () => {
    const flow: FlowDefinition = {
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const onStepStart = vi.fn()
    const onStepComplete = vi.fn()

    const options: RunOptions = {
      registry,
      onStepStart,
      onStepComplete,
    }

    const result = await executeFlow(flow, options, {}, run)

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

    const options: RunOptions = {
      registry,
      onStepStart,
    }

    const result = await executeFlow(flow, options, {}, run)

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

    const options: RunOptions = {
      registry,
      onFlowComplete,
    }

    const result = await executeFlow(flow, options, {}, run)

    expect(result.success).toBe(false)
    expect(onFlowComplete).toHaveBeenCalledWith(result)
  })

  it('triggers hooks in dryRun mode', async () => {
    const flow: FlowDefinition = {
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const onFlowStart = vi.fn()
    const onFlowComplete = vi.fn()

    const options: RunOptions = {
      registry,
      onFlowStart,
      onFlowComplete,
      dryRun: true,
    }

    const result = await executeFlow(flow, options, {}, run)

    expect(result.success).toBe(true)
    expect(onFlowStart).toHaveBeenCalled()
    expect(onFlowComplete).toHaveBeenCalled()
  })
})
