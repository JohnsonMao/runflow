import type { FlowDefinition, RunOptions } from './types'
import { describe, expect, it, vi } from 'vitest'
import { executeFlow } from './engine'
import { run } from './run'

describe('executeFlow hooks v2', () => {
  const stubHandler = {
    type: 'step',
    run: async (ctx: any) => {
      ctx.report({ success: true, outputs: { val: 1 } })
    },
  }

  const registry = { step: stubHandler }

  it('supports multiple hooks as an array', async () => {
    const flow: FlowDefinition = {
      steps: [{ id: 's1', type: 'step', dependsOn: [] }],
    }
    const h1 = vi.fn()
    const h2 = vi.fn()

    const options: RunOptions = {
      registry,
      onFlowStart: [h1, h2],
    }

    await executeFlow(flow, options, {}, run)

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

    const options: RunOptions = {
      registry,
      onFlowStart: asyncHook,
    }

    const result = await executeFlow(flow, options, {}, run)

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

    const options: RunOptions = {
      registry,
      onFlowStart: [h1, h2],
    }

    const result = await executeFlow(flow, options, {}, run)

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

    const options: RunOptions = {
      registry,
      onFlowStart: asyncHook,
    }

    await executeFlow(flow, options, {}, run)

    // We need to wait a bit for the async rejection to be caught
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(consoleSpy).toHaveBeenCalledWith('Error in flow hook (async):', expect.any(Error))

    consoleSpy.mockRestore()
  })
})
