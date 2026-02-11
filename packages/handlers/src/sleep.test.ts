import type { FlowStep, StepContext } from '@runflow/core'
import { stepResult } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { SleepHandler } from './sleep'

const noopRunSubFlow = async () => ({ results: [], newContext: {} })
const emptyContext: StepContext = { params: {}, runSubFlow: noopRunSubFlow, stepResult }

describe('sleep handler', () => {
  const handler = new SleepHandler()

  describe('validate', () => {
    it('returns true when step has seconds', () => {
      const step: FlowStep = { id: 'w', type: 'sleep', seconds: 1, dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns true when step has ms', () => {
      const step: FlowStep = { id: 'w', type: 'sleep', ms: 100, dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has neither seconds nor ms', () => {
      const step: FlowStep = { id: 'w', type: 'sleep', dependsOn: [] }
      expect(handler.validate(step)).toBe('sleep step requires seconds or ms (non-negative number)')
    })
  })

  describe('run', () => {
    it('waits for seconds then returns success with no outputs', async () => {
      const step: FlowStep = { id: 'wait', type: 'sleep', seconds: 0, dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toBeUndefined()
    })

    it('waits for ms then returns success', async () => {
      const step: FlowStep = { id: 'wait', type: 'sleep', ms: 10, dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
    })

    it('fails when duration is missing at run time', async () => {
      const step: FlowStep = { id: 'wait', type: 'sleep', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/seconds|ms|duration/i)
    })

    it('fails when seconds is negative at run time', async () => {
      const step: FlowStep = { id: 'wait', type: 'sleep', seconds: -1, dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/seconds|ms|duration/i)
    })
  })
})
