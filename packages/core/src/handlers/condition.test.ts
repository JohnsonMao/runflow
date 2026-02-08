import type { FlowStep } from '../types'
import { describe, expect, it } from 'vitest'
import { ConditionHandler } from './condition'

describe('condition handler', () => {
  const handler = new ConditionHandler()

  describe('validate', () => {
    it('returns true when step has when and then', () => {
      const step: FlowStep = { id: 'c', type: 'condition', when: 'true', then: 'a', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns true when step has when and else', () => {
      const step: FlowStep = { id: 'c', type: 'condition', when: 'true', else: 'b', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no when', () => {
      const step: FlowStep = { id: 'c', type: 'condition', dependsOn: [] }
      expect(handler.validate(step)).toContain('when')
    })

    it('returns error when step has when but neither then nor else', () => {
      const step: FlowStep = { id: 'c', type: 'condition', when: 'true', dependsOn: [] }
      expect(handler.validate(step)).toContain('then')
      expect(handler.validate(step)).toContain('else')
    })
  })

  describe('run', () => {
    it('returns nextSteps: then when expression is true', async () => {
      const step: FlowStep = {
        id: 'check',
        type: 'condition',
        when: 'params.flag === true',
        then: 'onTrue',
        else: 'onFalse',
        dependsOn: [],
      }
      const result = await handler.run(step, { params: { flag: true } })
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['onTrue'])
    })

    it('returns nextSteps: else when expression is false', async () => {
      const step: FlowStep = {
        id: 'check',
        type: 'condition',
        when: 'params.flag === true',
        then: 'onTrue',
        else: 'onFalse',
        dependsOn: [],
      }
      const result = await handler.run(step, { params: { flag: false } })
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['onFalse'])
    })

    it('returns error when when is missing at run time', async () => {
      const step = { id: 'c', type: 'condition', dependsOn: [] } as FlowStep
      const result = await handler.run(step, { params: {} })
      expect(result.success).toBe(false)
      expect(result.error).toContain('when')
    })

    it('returns error when expression throws', async () => {
      const step: FlowStep = {
        id: 'c',
        type: 'condition',
        when: 'params.missing.foo',
        then: 'x',
        else: 'y',
        dependsOn: [],
      }
      const result = await handler.run(step, { params: {} })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('does not merge result into outputs (no outputs)', async () => {
      const step: FlowStep = { id: 'check', type: 'condition', when: 'true', then: 'next', dependsOn: [] }
      const result = await handler.run(step, { params: {} })
      expect(result.success).toBe(true)
      expect(result.outputs).toBeUndefined()
    })
  })
})
