import { createFactoryContext } from '@runflow/core'
import { describe, expect, it, vi } from 'vitest'
import conditionHandlerFactory from './condition'

describe('condition handler', () => {
  const factoryContext = createFactoryContext()
  const handler = conditionHandlerFactory(factoryContext)

  const createMockContext = (step: any, params = {}) => ({
    step,
    params,
    report: vi.fn(),
    signal: new AbortController().signal,
  })

  it('implements getAllowedDependentIds (then + else)', () => {
    const step = { id: 'c', type: 'condition', when: 'true', then: ['a', 'b'], else: ['d'] }
    expect(handler.flowControl?.getAllowedDependentIds?.(step as any)).toEqual(['a', 'b', 'd'])
  })

  describe('schema', () => {
    it('returns true when step has when and then', () => {
      const step = { id: 'c', type: 'condition', when: 'true', then: 'a' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(true)
    })

    it('returns error when step has neither then nor else', () => {
      const step = { id: 'c', type: 'condition', when: 'true' }
      const parsed = handler.schema?.safeParse(step)
      expect(parsed?.success).toBe(false)
    })
  })

  describe('run', () => {
    it('returns nextSteps: then when expression is true', async () => {
      const step = {
        id: 'check',
        type: 'condition',
        when: 'params.flag === true',
        then: 'onTrue',
        else: 'onFalse',
      }
      const ctx = createMockContext(step, { flag: true })
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(result?.nextSteps).toEqual(['onTrue'])
    })

    it('returns nextSteps: else when expression is false', async () => {
      const step = {
        id: 'check',
        type: 'condition',
        when: 'params.flag === true',
        then: 'onTrue',
        else: 'onFalse',
      }
      const ctx = createMockContext(step, { flag: false })
      const result = await handler.run(ctx as any)
      expect(result?.success).toBe(true)
      expect(result?.nextSteps).toEqual(['onFalse'])
    })
  })
})
