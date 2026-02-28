/**
 * Single entry: run(flow, options). Validates DAG + params + canBeDependedOn, then runs engine.
 */
import type { FlowDefinition, RunOptions, RunResult } from './types'
import { getDAGStepIds, validateDAG } from './dag'
import { executeFlow } from './engine'
import { formatParamsValidationError, paramsDeclarationToZodSchema } from './paramsSchema'
import { validateCanBeDependedOn } from './validateCanBeDependedOn'

export async function run(flow: FlowDefinition, options: RunOptions = {}): Promise<RunResult> {
  let initialParams: Record<string, unknown> = { ...(options.params ?? {}) }

  const declaration = options.effectiveParamsDeclaration ?? flow.params
  if (declaration && declaration.length > 0) {
    const schema = paramsDeclarationToZodSchema(declaration)
    const parsed = schema.safeParse(options.params ?? {})
    if (!parsed.success) {
      const msg = formatParamsValidationError(declaration, parsed.error.errors)
      return {
        success: false,
        steps: [],
        error: msg,
      }
    }
    initialParams = parsed.data
  }

  const dagError = validateDAG(flow.steps)
  if (dagError) {
    return {
      success: false,
      steps: [],
      error: dagError,
    }
  }

  const dagIds = getDAGStepIds(flow.steps)
  if (dagIds.size > 0 && (options.registry == null || typeof options.registry !== 'object'))
    throw new Error('registry is required when flow has steps')

  const canBeDependedOnError = validateCanBeDependedOn(flow, options.registry ?? {})
  if (canBeDependedOnError) {
    return {
      success: false,
      steps: [],
      error: canBeDependedOnError,
    }
  }

  return executeFlow(flow, options, initialParams, run)
}
