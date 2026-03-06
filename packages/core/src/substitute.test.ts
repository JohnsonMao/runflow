import { describe, expect, it } from 'vitest'
import { substitute, substituteStep, substituteValue } from './substitute'

describe('substitute', () => {
  it('replaces root key', () => {
    expect(substitute('Hello {{ who }}', { who: 'world' })).toBe('Hello world')
  })

  it('replaces dot notation', () => {
    expect(substitute('{{ config.level }}', { config: { level: 2 } })).toBe('2')
  })

  it('replaces bracket notation for array index', () => {
    expect(substitute('{{ tags[0] }}', { tags: ['a', 'b'] })).toBe('a')
  })

  it('replaces mixed dot and bracket', () => {
    expect(substitute('{{ data.list[1] }}', { data: { list: [10, 20] } })).toBe('20')
  })

  it('replaces undefined with empty string', () => {
    expect(substitute('{{ missing }}', {})).toBe('')
  })

  it('replaces null in path with empty string', () => {
    expect(substitute('{{ obj.foo }}', { obj: null })).toBe('')
  })

  it('stringifies object value', () => {
    expect(substitute('{{ config }}', { config: { a: 1, b: 2 } })).toBe('{"a":1,"b":2}')
  })

  it('stringifies array value', () => {
    expect(substitute('{{ tags }}', { tags: ['x', 'y'] })).toBe('["x","y"]')
  })

  it('replaces multiple placeholders', () => {
    expect(substitute('{{ a }} and {{ b }}', { a: 1, b: 2 })).toBe('1 and 2')
  })

  it('path with property before bracket resolves', () => {
    expect(substitute('{{ data.items[1] }}', { data: { items: [10, 20, 30] } })).toBe('20')
  })
})

describe('substituteValue', () => {
  it('substitutes string', () => {
    expect(substituteValue('{{ a }}', { a: 1 })).toBe('1')
  })

  it('substitutes object recursively', () => {
    const input = {
      msg: 'Hello {{ name }}',
      meta: {
        id: '{{ id }}',
      },
    }
    const expected = {
      msg: 'Hello world',
      meta: {
        id: '123',
      },
    }
    expect(substituteValue(input, { name: 'world', id: '123' })).toEqual(expected)
  })

  it('substitutes array recursively', () => {
    const input = ['{{ a }}', { b: '{{ b }}' }]
    const expected = ['1', { b: '2' }]
    expect(substituteValue(input, { a: 1, b: 2 })).toEqual(expected)
  })

  it('leaves non-string values alone', () => {
    expect(substituteValue(123, {})).toBe(123)
    expect(substituteValue(true, {})).toBe(true)
    expect(substituteValue(null, {})).toBe(null)
  })
})

describe('substituteStep', () => {
  it('substitutes all fields except id and type', () => {
    const step = {
      id: '{{ skip_me }}',
      type: '{{ skip_me }}',
      url: 'http://{{ host }}',
      body: {
        data: '{{ payload }}',
      },
    }
    const context = {
      skip_me: 'WRONG',
      host: 'api.example.com',
      payload: 'hello',
    }
    const result = substituteStep(step, context)
    expect(result.id).toBe('{{ skip_me }}')
    expect(result.type).toBe('{{ skip_me }}')
    expect(result.url).toBe('http://api.example.com')
    expect(result.body).toEqual({ data: 'hello' })
  })
})
