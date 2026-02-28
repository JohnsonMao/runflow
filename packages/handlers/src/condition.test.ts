import type { FlowStep, StepContext } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { ConditionHandler } from './condition'
import { stepResult } from './test-helpers'

const ctx = (params: Record<string, unknown> = {}): StepContext => ({ params, stepResult })

describe('condition handler', () => {
  const handler = new ConditionHandler()

  it('implements getAllowedDependentIds (then + else)', () => {
    const step = { id: 'c', type: 'condition' as const, when: 'true', then: ['a', 'b'], else: ['d'], dependsOn: [] as string[] }
    expect(handler.getAllowedDependentIds(step)).toEqual(['a', 'b', 'd'])
  })

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
      const result = await handler.run(step, ctx({ flag: true }))
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
      const result = await handler.run(step, ctx({ flag: false }))
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['onFalse'])
    })

    it('evaluates missing nested param as falsy and returns else', async () => {
      const step: FlowStep = {
        id: 'c',
        type: 'condition',
        when: 'params.missing.foo',
        then: 'x',
        else: 'y',
        dependsOn: [],
      }
      const result = await handler.run(step, ctx())
      expect(result.success).toBe(true)
      expect(result.nextSteps).toEqual(['y'])
    })

    it('does not merge result into outputs (no outputs)', async () => {
      const step: FlowStep = { id: 'check', type: 'condition', when: 'true', then: 'next', dependsOn: [] }
      const result = await handler.run(step, ctx())
      expect(result.success).toBe(true)
      expect(result.outputs).toBeUndefined()
    })

    it('returns error when when is not a string at run time', async () => {
      const step = { id: 'c', type: 'condition' as const, when: 123, then: 'a', dependsOn: [] as string[] }
      const result = await handler.run(step as unknown as FlowStep, ctx())
      expect(result.success).toBe(false)
      expect(result.error).toContain('condition step requires when (string)')
    })

    it('returns error and message when expression throws or is invalid', async () => {
      const step: FlowStep = {
        id: 'c',
        type: 'condition',
        when: 'throw new Error("eval err")',
        then: 'a',
        else: 'b',
        dependsOn: [],
      }
      const result = await handler.run(step, ctx())
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
    })
  })
})
