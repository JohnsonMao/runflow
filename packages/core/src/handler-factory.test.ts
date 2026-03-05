import { describe, expect, it, vi } from 'vitest'
import { createFactoryContext } from './handler-factory'

describe('handler-factory', () => {
  it('defines a handler with type and run function', async () => {
    const { defineHandler } = createFactoryContext()
    const handler = defineHandler({
      type: 'test',
      run: async (context) => {
        context.report({ success: true, log: 'done' })
      },
    })

    expect(handler.type).toBe('test')
    expect(typeof handler.run).toBe('function')

    const report = vi.fn()
    await handler.run({
      step: { id: 's1', type: 'test' },
      params: {},
      report,
      signal: new AbortController().signal,
    })

    expect(report).toHaveBeenCalledWith({ success: true, log: 'done' })
  })

  it('validates step using zod schema', async () => {
    const { defineHandler, z } = createFactoryContext()
    const handler = defineHandler({
      type: 'test-schema',
      schema: z.object({
        msg: z.string(),
      }),
      run: async (context) => {
        context.report({ success: true, log: context.step.msg })
      },
    })

    expect(handler.schema).toBeDefined()

    // Test with valid data
    const validStep = { id: 's1', type: 'test-schema', msg: 'hello' }
    const parsed = handler.schema?.safeParse(validStep)
    expect(parsed?.success).toBe(true)

    // Test with invalid data
    const invalidStep = { id: 's1', type: 'test-schema', msg: 123 }
    const failed = handler.schema?.safeParse(invalidStep)
    expect(failed?.success).toBe(false)
  })

  it('provides chainable utils', () => {
    const { utils } = createFactoryContext()

    // str util
    const s = utils.str(' {{ hello }} ').trim().substitute({ hello: 'world' }).lowercase()
    expect(s.value()).toBe('world')

    // data util
    const d = utils.data({ a: 1, b: 2, c: 3 }).pick(['a', 'c']).merge({ d: 4 })
    expect(d.value()).toEqual({ a: 1, c: 3, d: 4 })
    expect(d.toJSON()).toBe('{"a":1,"c":3,"d":4}')
  })
})
