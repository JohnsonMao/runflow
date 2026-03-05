// @env node
import type { FactoryContext } from '@runflow/core'

function flowHandler({ defineHandler, z, utils }: FactoryContext) {
  return defineHandler({
    type: 'flow',
    schema: z.object({
      flow: z.string().min(1),
      params: z.record(z.unknown()).optional(),
    }),
    run: async (context) => {
      const { step, run: runFn, flowMap } = context

      if (!runFn) {
        return {
          success: false,
          error: 'run not available (flow step cannot run outside executor)',
        }
      }

      const flowId = step.flow
      const flow = flowMap?.[flowId]
      if (flow === undefined) {
        return {
          success: false,
          error: `flow not found: ${flowId}`,
        }
      }

      const params = utils.isPlainObject(step.params) ? step.params : {}

      try {
        const result = await runFn(flow, params)
        const mergedOutputs: Record<string, unknown> = {}
        for (const sr of result.steps) {
          if (sr.outputs && utils.isPlainObject(sr.outputs))
            Object.assign(mergedOutputs, sr.outputs)
        }
        if (result.success) {
          return {
            success: true,
            outputs: mergedOutputs,
            log: `flow ${flowId} → success`,
            subSteps: result.steps,
          }
        }
        const errorMessage = result.error ?? result.steps.find(s => !s.success)?.error ?? 'callee flow failed'
        return {
          success: false,
          error: errorMessage,
          outputs: Object.keys(mergedOutputs).length > 0 ? mergedOutputs : undefined,
          log: `flow ${flowId} → failed`,
          subSteps: result.steps,
        }
      }
      catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          success: false,
          error: message,
        }
      }
    },
  })
}

export default flowHandler
