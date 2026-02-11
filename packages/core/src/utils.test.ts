import { describe, expect, it } from 'vitest'
import { isPlainObject, normalizeStepIds } from './utils'

describe('normalizeStepIds', () => {
  it('returns [s] when given a single string', () => {
    expect(normalizeStepIds('s1')).toEqual(['s1'])
    expect(normalizeStepIds('step-a')).toEqual(['step-a'])
  })

  it('returns filtered string array when given array', () => {
    expect(normalizeStepIds(['a', 'b'])).toEqual(['a', 'b'])
    expect(normalizeStepIds(['a', 1, 'b', null, 'c'])).toEqual(['a', 'b', 'c'])
    expect(normalizeStepIds([1, 2, 3])).toEqual([])
  })

  it('returns empty array for non-string non-array', () => {
    expect(normalizeStepIds(null)).toEqual([])
    expect(normalizeStepIds(undefined)).toEqual([])
    expect(normalizeStepIds(1)).toEqual([])
    expect(normalizeStepIds({})).toEqual([])
  })
})

describe('isPlainObject', () => {
  it('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it('returns false for null, array, primitives', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject([1, 2])).toBe(false)
    expect(isPlainObject(1)).toBe(false)
    expect(isPlainObject('x')).toBe(false)
    expect(isPlainObject(true)).toBe(false)
  })
})
