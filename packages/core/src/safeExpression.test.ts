import { describe, expect, it } from 'vitest'
import { evaluate, evaluateToBoolean, SafeExpressionError } from './safeExpression'

describe('safeExpression', () => {
  describe('evaluateToBoolean', () => {
    it('evaluates params.x', () => {
      expect(evaluateToBoolean('params.foo', { foo: true })).toBe(true)
      expect(evaluateToBoolean('params.foo', { foo: false })).toBe(false)
      expect(evaluateToBoolean('params.foo', { foo: 1 })).toBe(true)
      expect(evaluateToBoolean('params.foo', {})).toBe(false)
    })

    it('evaluates comparison', () => {
      expect(evaluateToBoolean('params.x === 1', { x: 1 })).toBe(true)
      expect(evaluateToBoolean('params.x === 1', { x: 2 })).toBe(false)
      expect(evaluateToBoolean('params.x != 0', { x: 1 })).toBe(true)
      expect(evaluateToBoolean('params.x > 0', { x: 1 })).toBe(true)
      expect(evaluateToBoolean('params.x >= 1', { x: 1 })).toBe(true)
      expect(evaluateToBoolean('params.x < 2', { x: 1 })).toBe(true)
      expect(evaluateToBoolean('params.x <= 1', { x: 1 })).toBe(true)
    })

    it('evaluates simple arithmetic (+, -) in expressions', () => {
      expect(evaluateToBoolean('params.x >= params.n - 1', { x: 2, n: 3 })).toBe(true)
      expect(evaluateToBoolean('params.x >= params.n - 1', { x: 1, n: 3 })).toBe(false)
      expect(evaluateToBoolean('params.a + params.b === 10', { a: 3, b: 7 })).toBe(true)
      expect(evaluateToBoolean('-1 < 0', {})).toBe(true)
      expect(evaluateToBoolean('+1 > 0', {})).toBe(true)
    })

    it('evaluates logical', () => {
      expect(evaluateToBoolean('params.a && params.b', { a: true, b: true })).toBe(true)
      expect(evaluateToBoolean('params.a && params.b', { a: true, b: false })).toBe(false)
      expect(evaluateToBoolean('params.a || params.b', { a: false, b: true })).toBe(true)
      expect(evaluateToBoolean('!params.foo', { foo: false })).toBe(true)
      expect(evaluateToBoolean('!(params.x === 0)', { x: 1 })).toBe(true)
    })

    it('evaluates literals', () => {
      expect(evaluateToBoolean('true', {})).toBe(true)
      expect(evaluateToBoolean('false', {})).toBe(false)
      expect(evaluateToBoolean('null', {})).toBe(false)
      expect(evaluateToBoolean('1', {})).toBe(true)
      expect(evaluateToBoolean('0', {})).toBe(false)
    })

    it('rejects forbidden property access', () => {
      expect(() => evaluateToBoolean('params.constructor', {})).toThrow(SafeExpressionError)
      expect(() => evaluateToBoolean('params.prototype', {})).toThrow(SafeExpressionError)
      expect(() => evaluateToBoolean('params.__proto__', {})).toThrow(SafeExpressionError)
    })

    it('rejects code injection', () => {
      expect(() => evaluateToBoolean('params.constructor.constructor("return process")()', {})).toThrow(SafeExpressionError)
      expect(() => evaluateToBoolean('(function(){ return 1 })()', {})).toThrow()
    })

    it('respects maxLength', () => {
      const long = 'params.a'.padEnd(2001, ' ')
      expect(() => evaluateToBoolean(long, {}, { maxLength: 2000 })).toThrow(SafeExpressionError)
    })
  })

  describe('evaluate', () => {
    it('returns value for member expression', () => {
      expect(evaluate('params.foo', { foo: 42 })).toBe(42)
      expect(evaluate('params.x.y', { x: { y: 'hello' } })).toBe('hello')
      expect(evaluate('params', { a: 1 })).toEqual({ a: 1 })
    })

    it('returns literals', () => {
      expect(evaluate('42', {})).toBe(42)
      expect(evaluate('"hi"', {})).toBe('hi')
      expect(evaluate('\'hi\'', {})).toBe('hi')
      expect(evaluate('null', {})).toBe(null)
      expect(evaluate('true', {})).toBe(true)
    })

    it('evaluates simple arithmetic', () => {
      expect(evaluate('params.a + params.b', { a: 1, b: 2 })).toBe(3)
      expect(evaluate('params.n - 1', { n: 3 })).toBe(2)
      expect(evaluate('-1', {})).toBe(-1)
      expect(evaluate('+5', {})).toBe(5)
    })

    it('returns escaped strings', () => {
      expect(evaluate('"line1\\nline2"', {})).toBe('line1\nline2')
      expect(evaluate('\'tab\\tseparated\'', {})).toBe('tab\tseparated')
      expect(evaluate('"backslash\\\\"', {})).toBe('backslash\\')
    })

    it('evaluates bracket notation with expressions', () => {
      expect(evaluate('params.arr[1 + 1]', { arr: [10, 20, 30, 40] })).toBe(30)
      expect(evaluate('params.obj["a" + "b"]', { obj: { ab: 100 } })).toBe(100)
    })

    it('evaluates map method', () => {
      const data = { items: [{ id: 1 }, { id: 2 }] }
      expect(evaluate('params.items.map(id)', data)).toEqual([1, 2])
      expect(evaluate('params.items.map(missing)', data)).toEqual([undefined, undefined])
      expect(evaluate('params.notArray.map(id)', { notArray: 123 })).toEqual([])
    })

    it('evaluates filter method', () => {
      const data = { items: [{ id: 1, active: true }, { id: 2, active: false }, { id: 3, active: true }] }
      expect(evaluate('params.items.filter(active)', data)).toEqual([{ id: 1, active: true }, { id: 3, active: true }])
      expect(evaluate('params.items.filter(id > 1)', data)).toEqual([{ id: 2, active: false }, { id: 3, active: true }])
      expect(evaluate('params.items.filter(val.id === 2)', data)).toEqual([{ id: 2, active: false }])
    })

    it('evaluates slice method', () => {
      const data = { arr: [1, 2, 3, 4, 5] }
      expect(evaluate('params.arr.slice(1)', data)).toEqual([2, 3, 4, 5])
      expect(evaluate('params.arr.slice(1, 3)', data)).toEqual([2, 3])
      expect(evaluate('params.arr.slice(-2)', data)).toEqual([4, 5])
    })

    it('evaluates method chain', () => {
      const data = { items: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }] }
      expect(evaluate('params.items.map(v).filter(val > 2).slice(0, 1)', data)).toEqual([3])
    })

    it('rejects unknown methods', () => {
      expect(() => evaluate('params.arr.sort()', { arr: [1] })).toThrow(/Unknown method: sort/)
    })
  })
})
