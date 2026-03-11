import type { FlowStep } from '@runflow/core'
import type { WorkspaceContext } from './workspace-api'
import { run } from '@runflow/core'
import { buildFlowMapForRun, buildRegistryFromConfig, flowDefinitionToGraphForVisualization, mergeParamDeclarations, resolveAndLoadFlow } from '@runflow/workspace'

export interface ExecutionOptions {
  params?: Record<string, unknown>
  shouldBroadcast?: boolean
  skipRun?: boolean
}

export async function reloadAndExecuteFlow(
  ctx: WorkspaceContext,
  flowId: string,
  options: ExecutionOptions = {},
) {
  const { params, shouldBroadcast = true, skipRun = false } = options
  const broadcast = shouldBroadcast ? ctx.broadcast : undefined

  // 1. Resolve and Load fresh flow
  const loaded = await resolveAndLoadFlow(flowId, ctx.config, ctx.configDir, ctx.cwd)

  // 2. Merge params
  const effectiveParamsDeclaration = mergeParamDeclarations(ctx.config?.params, loaded.flow.params)

  // 3. Prepare Graph for UI reload
  const graph = flowDefinitionToGraphForVisualization(loaded.flow)
  if (broadcast) {
    broadcast('FLOW_RELOAD', {
      ...graph,
      flowId,
      params: effectiveParamsDeclaration,
    })
  }

  if (skipRun) {
    return { loaded, effectiveParamsDeclaration }
  }

  // 4. Prepare for Run
  const registry = await buildRegistryFromConfig(ctx.config, ctx.configDir)
  const flowMap = await buildFlowMapForRun(loaded.flow, id =>
    resolveAndLoadFlow(id, ctx.config, ctx.configDir, ctx.cwd).then(l => ({ flow: l.flow })))

  if (broadcast) {
    broadcast('FLOW_START', { flowId })
  }

  // 5. Run
  const result = await run(loaded.flow, {
    registry,
    params,
    effectiveParamsDeclaration,
    flowMap,
    onStepStart: (stepId: string, _step: FlowStep) => {
      broadcast?.('STEP_STATE_CHANGE', { stepId, status: 'running' })
    },
    onStepComplete: (stepId: string, stepResult: any) => {
      broadcast?.('STEP_STATE_CHANGE', {
        stepId,
        status: stepResult.success ? 'success' : 'failure',
        error: stepResult.error,
        outputs: stepResult.outputs,
      })
    },
  })

  if (broadcast) {
    const { formatRunResult } = await import('@runflow/workspace')
    const formatted = formatRunResult(result)

    if (!result.success) {
      console.error(`[Execution] Flow error: ${result.error}`)
    }
    broadcast('FLOW_COMPLETE', {
      flowId,
      success: result.success,
      result: formatted,
      raw: result,
    })
  }

  return { loaded, result, effectiveParamsDeclaration }
}
