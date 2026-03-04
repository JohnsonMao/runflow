import type { FlowStep, StepContext } from '@runflow/core'
import { createFactoryContext, handlerConfigToStepHandler } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import setHandlerFactory from './set'
import { stepResult } from './test-helpers'

const emptyContext: StepContext = { params: {}, stepResult }

describe('set handler', () => {
  const factoryContext = createFactoryContext()
  const handlerConfig = setHandlerFactory(factoryContext)
  const handler = handlerConfigToStepHandler(handlerConfig)

  describe('validate', () => {
    it('returns true when step has set (object)', () => {
      const step: FlowStep = { id: 's1', type: 'set', set: { flag: true }, dependsOn: [] }
      expect(handler.validate?.(step)).toBe(true)
    })

    it('returns error when step has no set', () => {
      const step: FlowStep = { id: 's1', type: 'set', dependsOn: [] }
      expect(handler.validate?.(step)).toContain('set')
    })
  })

  describe('run', () => {
    it('merges set object into outputs', async () => {
      const step: FlowStep = { id: 's1', type: 'set', set: { flag: true, n: 42 }, dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ flag: true, n: 42 })
    })

    it('fails when set is missing at run time', async () => {
      const step = { id: 's1', type: 'set', dependsOn: [] } as FlowStep
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('set step requires set')
    })
  })
})
