import type { FlowStep, StepContext } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { MessageHandler } from './message'
import { stepResult } from './test-helpers'

const emptyContext: StepContext = { params: {}, stepResult }

describe('message handler', () => {
  const handler = new MessageHandler()

  describe('validate', () => {
    it('returns true when step has message (string)', () => {
      const step: FlowStep = { id: 'm1', type: 'message', message: 'Hello', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no message', () => {
      const step: FlowStep = { id: 'm1', type: 'message', dependsOn: [] }
      expect(handler.validate(step)).toBe('message step requires message (string)')
    })

    it('returns error when message is not a string', () => {
      const step = { id: 'm1', type: 'message', message: 123, dependsOn: [] } as FlowStep
      expect(handler.validate(step)).toBe('message step requires message (string)')
    })
  })

  describe('run', () => {
    it('returns success with log set to message and no outputs', async () => {
      const step: FlowStep = { id: 'm1', type: 'message', message: 'Starting batch run', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.log).toBe('Starting batch run')
      expect(result.outputs).toBeUndefined()
    })

    it('fails when message is missing at run time', async () => {
      const step = { id: 'm1', type: 'message', dependsOn: [] } as FlowStep
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('message step requires message')
    })

    it('fails when message is not a string at run time', async () => {
      const step = { id: 'm1', type: 'message', message: null, dependsOn: [] } as FlowStep
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('message step requires message')
    })
  })
})
