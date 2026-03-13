import type { FlowStep, StepResult } from '@runflow/core'
import type { BroadcastFunction, FlowGraphResponse } from '../src/types'
import type { WorkspaceContext } from './workspace-api'
import { run } from '@runflow/core'
import {
  buildFlowMapForRun,
  buildRegistryFromConfig,
  flowDefinitionToGraphForVisualization,
  mergeParamDeclarations,
  resolveAndLoadFlow,
} from '@runflow/workspace'

/**
 * Parse error message to extract field paths.
 * Format: \"path1 (required): message1; path2: message2\"
 * Returns array of paths like [\"path1\", \"path2\"]
 */
function parseErrorPaths(errorMessage: string): string[] {
  const paths: string[] = []
  const errors = errorMessage.split(';')
  for (const error of errors) {
    const colonIndex = error.indexOf(':')
    if (colonIndex > 0) {
      const pathPart = error.slice(0, colonIndex).trim()
      const path = pathPart.replace(/\s*\(required\)\s*$/, '').trim()
      if (path)
        paths.push(path)
    }
  }
  return paths
}

export interface ExecutionOptions {
  params?: Record<string, unknown>
  shouldBroadcast?: boolean
  skipRun?: boolean
}

/**
 * Main entry point for loading and executing a flow from the viewer.
 */
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
  const graphResponse: FlowGraphResponse = {
    ...graph,
    flowId,
    params: effectiveParamsDeclaration,
  }

  if (broadcast) {
    broadcast('FLOW_RELOAD', graphResponse)
  }

  if (skipRun) {
    return { loaded, effectiveParamsDeclaration }
  }

  // 4. Run the flow
  const result = await executeFlowWithBroadcast(ctx, loaded, {
    params,
    effectiveParamsDeclaration,
    broadcast,
  })

  return { loaded, result, effectiveParamsDeclaration }
}

/**
 * Executes a loaded flow and broadcasts its state changes.
 */
export async function executeFlowWithBroadcast(
  ctx: WorkspaceContext,
  loaded: Awaited<ReturnType<typeof resolveAndLoadFlow>>,
  options: {
    params?: Record<string, unknown>
    effectiveParamsDeclaration: ReturnType<typeof mergeParamDeclarations>
    broadcast?: BroadcastFunction
  },
) {
  const { params, effectiveParamsDeclaration, broadcast } = options
  const registry = await buildRegistryFromConfig(ctx.config, ctx.configDir)
  const flowMap = await buildFlowMapForRun(loaded.flow, id =>
    resolveAndLoadFlow(id, ctx.config, ctx.configDir, ctx.cwd).then(l => ({ flow: l.flow })))

  if (broadcast && loaded.flow.id) {
    broadcast('FLOW_START', { flowId: loaded.flow.id })
  }

  const startedSteps = new Set<string>()
  const completedSteps = new Set<string>()

  const result = await run(loaded.flow, {
    registry,
    params,
    effectiveParamsDeclaration,
    flowMap,
    onStepStart: (stepId: string, _step: FlowStep) => {
      startedSteps.add(stepId)
      broadcast?.('STEP_STATE_CHANGE', { stepId, status: 'running' })
    },
    onStepComplete: (stepId: string, stepResult: StepResult) => {
      completedSteps.add(stepId)
      broadcast?.('STEP_STATE_CHANGE', {
        stepId,
        status: stepResult.success ? 'success' : 'failure',
        error: stepResult.error,
        outputs: stepResult.outputs,
      })
    },
  })

  if (broadcast) {
    handleExecutionBroadcasting(broadcast, result, startedSteps, completedSteps)
  }

  return result
}

/**
 * Handles final broadcasting after execution, ensuring all steps have a final state
 * and reporting validation errors.
 */
function handleExecutionBroadcasting(
  broadcast: BroadcastFunction,
  result: Awaited<ReturnType<typeof run>>,
  startedSteps: Set<string>,
  completedSteps: Set<string>,
) {
  // If validation failed before any steps ran
  if (!result.success && result.steps.length === 0 && result.error) {
    broadcast('PARAMS_VALIDATION_ERROR', {
      error: result.error,
      fieldPaths: parseErrorPaths(result.error),
    })
  }

  const stepResultMap = new Map<string, StepResult>()
  for (const stepResult of result.steps) {
    stepResultMap.set(stepResult.stepId, stepResult)
  }

  // Ensure all started steps have completion status
  for (const stepId of startedSteps) {
    if (!completedSteps.has(stepId)) {
      const stepResult = stepResultMap.get(stepId)
      if (stepResult) {
        broadcast('STEP_STATE_CHANGE', {
          stepId,
          status: stepResult.success ? 'success' : 'failure',
          error: stepResult.error,
          outputs: stepResult.outputs,
        })
      }
      else {
        broadcast('STEP_STATE_CHANGE', {
          stepId,
          status: 'failure',
          error: result.error || 'Flow execution aborted',
          outputs: undefined,
        })
      }
    }
  }

  // Safety net for tracked step results that weren't broadcast
  for (const stepResult of result.steps) {
    if (stepResult.stepId.includes('.'))
      continue

    if (!startedSteps.has(stepResult.stepId) && !completedSteps.has(stepResult.stepId)) {
      broadcast('STEP_STATE_CHANGE', {
        stepId: stepResult.stepId,
        status: stepResult.success ? 'success' : 'failure',
        error: stepResult.error,
        outputs: stepResult.outputs,
      })
    }
  }
}
