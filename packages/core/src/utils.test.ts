import { describe, expect, it } from 'vitest'
import { isPlainObject, normalizeFlowId, normalizeStepIds, redact, truncate } from './utils'

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

describe('redact', () => {
  it('redacts sensitive keys in objects', () => {
    const input = {
      id: 1,
      token: 'secret-token',
      password: 'pass',
      nested: {
        apiKey: 'key',
        safe: 'value',
      },
      arr: [
        { secret: 's1' },
        { safe: 's2' },
      ],
    }
    const expected = {
      id: 1,
      token: '[REDACTED]',
      password: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        safe: 'value',
      },
      arr: [
        { secret: '[REDACTED]' },
        { safe: 's2' },
      ],
    }
    expect(redact(input)).toEqual(expected)
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    const long = 'a'.repeat(3000)
    const res = truncate(long, 2048)
    expect(res.length).toBeLessThan(3000)
    expect(res).toContain('... (truncated, use \'inspect\' to view full)')
  })

  it('does not truncate short strings', () => {
    const short = 'hello'
    expect(truncate(short)).toBe('hello')
  })
})

describe('normalizeFlowId', () => {
  it('should normalize special characters', () => {
    expect(normalizeFlowId('tt%2Fpost-users.yaml')).toBe('tt_2Fpost-users.yaml')
    expect(normalizeFlowId('scm%3Apost-scm-V1-Category-GetCategory')).toBe('scm_3Apost-scm-V1-Category-GetCategory')
    expect(normalizeFlowId('tt/post-users.yaml')).toBe('tt_post-users.yaml')
    expect(normalizeFlowId('scm:post-scm-V1-Category-GetCategory')).toBe('scm_post-scm-V1-Category-GetCategory')
  })

  it('should preserve hyphens, underscores, and dots', () => {
    expect(normalizeFlowId('get-users')).toBe('get-users')
    expect(normalizeFlowId('get_users')).toBe('get_users')
    expect(normalizeFlowId('get.users')).toBe('get.users')
    expect(normalizeFlowId('get-users_id.v1')).toBe('get-users_id.v1')
  })

  it('should collapse consecutive underscores', () => {
    expect(normalizeFlowId('get__users')).toBe('get_users')
    expect(normalizeFlowId('api___call')).toBe('api_call')
    expect(normalizeFlowId('test____multiple')).toBe('test_multiple')
  })

  it('should remove leading and trailing underscores', () => {
    expect(normalizeFlowId('_get-users')).toBe('get-users')
    expect(normalizeFlowId('get-users_')).toBe('get-users')
    expect(normalizeFlowId('_get-users_')).toBe('get-users')
    expect(normalizeFlowId('___test___')).toBe('test')
  })

  it('should handle percent signs and other special characters', () => {
    expect(normalizeFlowId('test%ZZinvalid')).toBe('test_ZZinvalid')
    expect(normalizeFlowId('test%GG')).toBe('test_GG')
    expect(normalizeFlowId('test%')).toBe('test')
  })

  it('should handle edge cases', () => {
    expect(normalizeFlowId('')).toBe('')
    expect(normalizeFlowId('_')).toBe('')
    expect(normalizeFlowId('___')).toBe('')
    expect(normalizeFlowId('only-special-chars')).toBe('only-special-chars')
    expect(normalizeFlowId('test/path/to/file')).toBe('test_path_to_file')
    expect(normalizeFlowId('test:path:to:file')).toBe('test_path_to_file')
    expect(normalizeFlowId('test path with spaces')).toBe('test_path_with_spaces')
  })

  it('should normalize complex cases', () => {
    expect(normalizeFlowId('tt%2Fpost-users.yaml')).toBe('tt_2Fpost-users.yaml')
    expect(normalizeFlowId('scm%3Apost-scm-V1-Category-GetCategory')).toBe('scm_3Apost-scm-V1-Category-GetCategory')
    expect(normalizeFlowId('api/v1/users/{id}')).toBe('api_v1_users_id')
    expect(normalizeFlowId('test%2Fpath%2Fto%2Ffile')).toBe('test_2Fpath_2Fto_2Ffile')
    expect(normalizeFlowId('test/path/to/file')).toBe('test_path_to_file')
  })
})
