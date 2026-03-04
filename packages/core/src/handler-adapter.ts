import type { z } from 'zod'
import type { HandlerConfig, HandlerContext, InferStepFromSchema, SimpleResult } from './handler-factory'
/**
 * Adapter to convert HandlerConfig (factory pattern) to IStepHandler (legacy interface).
 * This allows the engine to work with both patterns during migration.
 */
import type { FlowStep, IStepHandler, StepContext, StepResult } from './types'
import { stepResult } from './engine'

/** Convert HandlerConfig to IStepHandler for engine compatibility. */
export function handlerConfigToStepHandler<TSchema extends z.ZodTypeAny = z.ZodTypeAny>(
  config: HandlerConfig<TSchema>,
): IStepHandler {
  return {
    validate: (s: FlowStep): true | string => {
      if (config.schema) {
        const parsed = config.schema.safeParse(s)
        if (!parsed.success) {
          const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
          return errors
        }
      }
      return true
    },
    run: async (s: FlowStep, ctx: StepContext): Promise<StepResult> => {
      const reportedResults: SimpleResult[] = []

      // Create a signal if not provided (for backward compatibility)
      const signal = ctx.signal ?? new AbortController().signal

      const handlerCtx: HandlerContext = {
        step: s,
        params: ctx.params,
        report: (result: SimpleResult) => {
          reportedResults.push(result)
        },
        signal,
        run: ctx.run,
        steps: ctx.steps,
        flowMap: ctx.flowMap,
      }

      try {
        // Type assertion: at runtime, s is FlowStep, but config.run expects HandlerContext<InferStepFromSchema<TSchema>>
        // This is safe because schema validation ensures s matches TSchema, and FlowStep is compatible with any inferred type
        const returnValue = await config.run(handlerCtx as HandlerContext<InferStepFromSchema<TSchema>>)

        // Merge all reported results and return value
        const allResults = [...reportedResults]
        if (returnValue !== undefined) {
          allResults.push(returnValue)
        }

        // Aggregate results: last one wins for most fields, but merge outputs and logs
        const finalResult: SimpleResult = {
          success: true,
        }

        for (const result of allResults) {
          if (result.success !== undefined)
            finalResult.success = result.success
          if (result.error !== undefined)
            finalResult.error = result.error
          if (result.log !== undefined) {
            finalResult.log = finalResult.log ? `${finalResult.log}\n${result.log}` : result.log
          }
          if (result.nextSteps !== undefined)
            finalResult.nextSteps = result.nextSteps
          if (result.completedStepIds !== undefined)
            finalResult.completedStepIds = result.completedStepIds
          if (result.subSteps !== undefined)
            finalResult.subSteps = result.subSteps
          if (result.outputs !== undefined) {
            finalResult.outputs = {
              ...finalResult.outputs,
              ...result.outputs,
            }
          }
        }

        return stepResult(s.id, finalResult.success ?? true, {
          error: finalResult.error,
          outputs: finalResult.outputs,
          log: finalResult.log,
          nextSteps: finalResult.nextSteps,
          completedStepIds: finalResult.completedStepIds,
          subSteps: finalResult.subSteps,
        })
      }
      catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return stepResult(s.id, false, { error: message })
      }
    },
    kill: () => {
      // Handlers using AbortSignal will check signal.aborted
      // Legacy handlers may implement kill() method
    },
    getAllowedDependentIds: config.flowControl?.getAllowedDependentIds,
  }
}
