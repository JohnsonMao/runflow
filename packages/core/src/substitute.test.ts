import { describe, expect, it } from 'vitest'
import { substitute } from './substitute'

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
})
