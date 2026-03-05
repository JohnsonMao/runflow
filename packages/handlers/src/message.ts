// @env node
import type { FactoryContext } from '@runflow/core'

function messageHandler({ defineHandler, z }: FactoryContext) {
  return defineHandler({
    type: 'message',
    schema: z.object({
      message: z.string().min(1),
    }),
    run: async (context) => {
      const { step } = context
      return {
        success: true,
        log: step.message,
      }
    },
  })
}

export default messageHandler
