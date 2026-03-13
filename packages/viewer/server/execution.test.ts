import type { FlowDefinition, RunOptions } from '@runflow/core'
import type { WorkspaceContext } from './workspace-api'
import * as core from '@runflow/core'
import * as workspace from '@runflow/workspace'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadAndExecuteFlow } from './execution'

vi.mock('@runflow/workspace', () => ({
  resolveAndLoadFlow: vi.fn(async (id: string) => ({
    flowId: id,
    flow: { id, name: 'Test Flow', steps: [] },
    resolvedPath: '/test/flow.yaml',
  })),
  mergeParamDeclarations: vi.fn(() => []),
  flowDefinitionToGraphForVisualization: vi.fn(() => ({ nodes: [], edges: [] })),
  buildRegistryFromConfig: vi.fn(async () => ({})),
  buildFlowMapForRun: vi.fn(async () => ({})),
}))

vi.mock('@runflow/core', () => ({
  run: vi.fn(async () => ({ success: true, steps: [] })),
}))

describe('execution', () => {
  let mockCtx: WorkspaceContext
  let mockBroadcast: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockBroadcast = vi.fn()
    mockCtx = {
      cwd: '/test',
      configDir: '/test',
      configPath: '/test/c.json',
      config: {} as any,
      broadcast: mockBroadcast,
    }
  })

  it('should reload flow and broadcast FLOW_RELOAD', async () => {
    await reloadAndExecuteFlow(mockCtx, 'test-flow', { skipRun: true })

    expect(workspace.resolveAndLoadFlow).toHaveBeenCalledWith('test-flow', expect.anything(), expect.anything(), expect.anything())
    expect(mockBroadcast).toHaveBeenCalledWith('FLOW_RELOAD', expect.objectContaining({
      flowId: 'test-flow',
    }))
  })

  it('should execute flow and broadcast FLOW_START and STEP_STATE_CHANGE', async () => {
    // Mock run to simulate step events
    (core.run as any).mockImplementation(async (_flow: FlowDefinition, options: RunOptions) => {
      if (typeof options.onStepStart === 'function') {
        options.onStepStart('step1', { id: 'step1', type: 'test' })
      }
      if (typeof options.onStepComplete === 'function') {
        options.onStepComplete('step1', { stepId: 'step1', success: true, outputs: { res: 1 } })
      }
      return { success: true, steps: [{ stepId: 'step1', success: true, outputs: { res: 1 } }] }
    })

    await reloadAndExecuteFlow(mockCtx, 'test-flow')

    expect(mockBroadcast).toHaveBeenCalledWith('FLOW_START', { flowId: 'test-flow' })
    expect(mockBroadcast).toHaveBeenCalledWith('STEP_STATE_CHANGE', expect.objectContaining({
      stepId: 'step1',
      status: 'running',
    }))
    expect(mockBroadcast).toHaveBeenCalledWith('STEP_STATE_CHANGE', expect.objectContaining({
      stepId: 'step1',
      status: 'success',
      outputs: { res: 1 },
    }))
  })

  it('should broadcast PARAMS_VALIDATION_ERROR if execution fails before steps', async () => {
    (core.run as any).mockResolvedValue({
      success: false,
      steps: [],
      error: 'param1: is required',
    })

    await reloadAndExecuteFlow(mockCtx, 'test-flow')

    expect(mockBroadcast).toHaveBeenCalledWith('PARAMS_VALIDATION_ERROR', expect.objectContaining({
      error: 'param1: is required',
      fieldPaths: ['param1'],
    }))
  })
})
