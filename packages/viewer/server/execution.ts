import type { FlowStep, StepResult } from '@runflow/core'
import type { WorkspaceContext } from './workspace-api'
import { run } from '@runflow/core'
import { buildFlowMapForRun, buildRegistryFromConfig, flowDefinitionToGraphForVisualization, mergeParamDeclarations, resolveAndLoadFlow } from '@runflow/workspace'

/**
 * Parse error message to extract field paths.
 * Format: "path1 (required): message1; path2: message2"
 * Returns array of paths like ["path1", "path2"]
 */
function parseErrorPaths(errorMessage: string): string[] {
  const paths: string[] = []
  // Split by semicolon to get individual errors
  const errors = errorMessage.split(';')
  for (const error of errors) {
    // Find the colon that separates path from message
    const colonIndex = error.indexOf(':')
    if (colonIndex > 0) {
      const pathPart = error.slice(0, colonIndex).trim()
      // Remove "(required)" from path if present
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

  // Track started steps to ensure they all get completion callbacks
  const startedSteps = new Set<string>()
  const completedSteps = new Set<string>()

  // 5. Run
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

  // If validation failed before any steps ran, broadcast error via WebSocket
  if (!result.success && result.steps.length === 0 && result.error && broadcast) {
    broadcast('PARAMS_VALIDATION_ERROR', {
      error: result.error,
      // Parse error message to extract field paths
      // Format: "path1 (required): message1; path2: message2"
      fieldPaths: parseErrorPaths(result.error),
    })
  }

  // Ensure all started steps have completion status
  // This handles cases where flow aborts before all steps complete
  if (broadcast) {
    // Create a map of step results for quick lookup
    const stepResultMap = new Map<string, StepResult>()
    for (const stepResult of result.steps) {
      stepResultMap.set(stepResult.stepId, stepResult)
    }

    // Ensure all started steps have completion status
    for (const stepId of startedSteps) {
      if (!completedSteps.has(stepId)) {
        const stepResult = stepResultMap.get(stepId)
        if (stepResult) {
          // Step completed but callback might have been missed
          broadcast('STEP_STATE_CHANGE', {
            stepId,
            status: stepResult.success ? 'success' : 'failure',
            error: stepResult.error,
            outputs: stepResult.outputs,
          })
        }
        else {
          // Step was started but never completed - mark as failure
          broadcast('STEP_STATE_CHANGE', {
            stepId,
            status: 'failure',
            error: result.error || 'Flow execution aborted',
            outputs: undefined,
          })
        }
      }
    }

    // Also broadcast any step results that weren't tracked (shouldn't happen, but safety net)
    // Skip subSteps (stepId contains '.') as they are flattened from parent steps and already
    // triggered hooks during execution with their original stepIds
    for (const stepResult of result.steps) {
      if (stepResult.stepId.includes('.')) {
        // This is a subStep (e.g., "loop.iteration_1.loopBody"), skip it as it was already
        // broadcast during execution with its original stepId (e.g., "loopBody")
        continue
      }
      if (!startedSteps.has(stepResult.stepId) && !completedSteps.has(stepResult.stepId)) {
        // This step completed but never had onStepStart called (shouldn't happen)
        broadcast('STEP_STATE_CHANGE', {
          stepId: stepResult.stepId,
          status: stepResult.success ? 'success' : 'failure',
          error: stepResult.error,
          outputs: stepResult.outputs,
        })
      }
    }
  }

  return { loaded, result, effectiveParamsDeclaration }
}
