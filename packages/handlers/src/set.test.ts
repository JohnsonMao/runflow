import type { FlowStep, StepContext } from '@runflow/core'
import { stepResult } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { SetHandler } from './set'

const noopRunSubFlow = async () => ({ results: [], newContext: {} })
const emptyContext: StepContext = { params: {}, runSubFlow: noopRunSubFlow, stepResult }

describe('set handler', () => {
  const handler = new SetHandler()

  describe('validate', () => {
    it('returns true when step has set (object)', () => {
      const step: FlowStep = { id: 's1', type: 'set', set: { flag: true }, dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no set', () => {
      const step: FlowStep = { id: 's1', type: 'set', dependsOn: [] }
      expect(handler.validate(step)).toBe('set step requires set (object)')
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
