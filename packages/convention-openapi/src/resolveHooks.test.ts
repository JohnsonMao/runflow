import { describe, expect, it } from 'vitest'
import { resolveHooksForKey } from './resolveHooks.js'

describe('resolveHooksForKey', () => {
  it('returns undefined when hooks is undefined', () => {
    expect(resolveHooksForKey('get-users', undefined)).toBeUndefined()
  })

  it('returns hooks for exact key when hooks is Record', () => {
    const hooks = {
      'get-users': { before: [{ type: 'set', set: {} }] },
    }
    expect(resolveHooksForKey('get-users', hooks)).toEqual({ before: [{ type: 'set', set: {} }] })
    expect(resolveHooksForKey('get-users-id', hooks)).toBeUndefined()
  })

  it('returns merged hooks when hooks is array and pattern is string match', () => {
    const hooks = [
      { pattern: 'get-users', hooks: { before: [{ type: 'set', set: {} }] } },
    ]
    expect(resolveHooksForKey('get-users', hooks)).toEqual({
      before: [{ type: 'set', set: {} }],
      after: [],
    })
    expect(resolveHooksForKey('get-users-id', hooks)).toBeUndefined()
  })

  it('returns undefined when hooks array matches but before and after are empty', () => {
    const hooks = [
      { pattern: /get/, hooks: { before: [], after: [] } },
    ]
    const result = resolveHooksForKey('get-users', hooks)
    expect(result).toBeUndefined()
  })

  it('matches with regex when hooks is array', () => {
    const hooks = [
      { pattern: /^get-/, hooks: { after: [{ type: 'set', set: {} }] } },
    ]
    const result = resolveHooksForKey('get-users', hooks)
    expect(result?.after).toHaveLength(1)
    expect(resolveHooksForKey('post-users', hooks)).toBeUndefined()
  })
})
