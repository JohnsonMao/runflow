// @env node
import type { FactoryContext, FlowStep } from '@runflow/core'

function conditionHandler({ defineHandler, z, utils }: FactoryContext) {
  return defineHandler({
    schema: z.object({
      when: z.string().min(1),
      then: z.union([z.string(), z.array(z.string())]).optional(),
      else: z.union([z.string(), z.array(z.string())]).optional(),
    }).refine(
      (data) => {
        const thenIds = utils.normalizeStepIds(data.then)
        const elseIds = utils.normalizeStepIds(data.else)
        return thenIds.length > 0 || elseIds.length > 0
      },
      {
        message: 'condition step requires at least one of then or else (step id or array of ids)',
      },
    ),
    flowControl: {
      getAllowedDependentIds: (step: FlowStep) => {
        return [...utils.normalizeStepIds(step.then), ...utils.normalizeStepIds(step.else)]
      },
    },
    run: async (context) => {
      const { step, params } = context
      const when = step.when

      if (typeof when !== 'string') {
        return {
          success: false,
          error: 'condition step requires when (string)',
        }
      }

      try {
        const value = utils.evaluateToBoolean(when, params, { maxLength: 2000 })
        const nextSteps = value ? utils.normalizeStepIds(step.then) : utils.normalizeStepIds(step.else)
        const branch = value ? 'then' : 'else'
        return {
          success: true,
          nextSteps,
          log: `branch: ${branch}`,
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

export default conditionHandler
