// @env node
import type { FactoryContext } from '@runflow/core'

function setHandler({ defineHandler, z, utils }: FactoryContext) {
  return defineHandler({
    type: 'set',
    schema: z.object({
      set: z.record(z.unknown()),
    }),
    run: async (context) => {
      const { step } = context
      const set = step.set

      if (!utils.isPlainObject(set)) {
        return {
          success: false,
          error: 'set step requires set (object)',
        }
      }

      return {
        success: true,
        outputs: set,
      }
    },
  })
}

export default setHandler
