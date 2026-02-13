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
    })
  })
})
