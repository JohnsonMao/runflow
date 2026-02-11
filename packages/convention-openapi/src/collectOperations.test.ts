import type { OpenApiDocument } from './types.js'
import { describe, expect, it } from 'vitest'
import { collectOperations, toOperationKey } from './collectOperations.js'

describe('toOperationKey', () => {
  it('lowercases method and normalizes path', () => {
    expect(toOperationKey('GET', '/users')).toBe('get-users')
    expect(toOperationKey('Post', '/users')).toBe('post-users')
    expect(toOperationKey('GET', '/users/{id}')).toBe('get-users-id')
  })
})

describe('collectOperations', () => {
  const doc: OpenApiDocument = {
    openapi: '3.0.0',
    paths: {
      '/users': {
        get: { operationId: 'listUsers', tags: ['users'] },
        post: { operationId: 'createUser', tags: ['users'] },
      },
      '/items': {
        get: { operationId: 'listItems', tags: ['items'] },
      },
    },
  } as OpenApiDocument

  it('returns all operations without filter', () => {
    const ops = collectOperations(doc)
    expect(ops.length).toBe(3)
    expect(ops.map(o => o.key)).toContain('get-users')
    expect(ops.map(o => o.key)).toContain('post-users')
    expect(ops.map(o => o.key)).toContain('get-items')
  })

  it('filters by method when operationFilter.method is set', () => {
    const ops = collectOperations(doc, { method: 'get' })
    expect(ops.length).toBe(2)
    expect(ops.every(o => o.method === 'get')).toBe(true)
  })

  it('filters by path when operationFilter.path is set', () => {
    const ops = collectOperations(doc, { path: '/items' })
    expect(ops.length).toBe(1)
    expect(ops[0].path).toBe('/items')
    expect(ops[0].key).toBe('get-items')
  })

  it('filters by operationId when operationFilter.operationId is set', () => {
    const ops = collectOperations(doc, { operationId: 'createUser' })
    expect(ops.length).toBe(1)
    expect((ops[0].operation as { operationId?: string }).operationId).toBe('createUser')
  })

  it('filters by tags when operationFilter.tags is set', () => {
    const ops = collectOperations(doc, { tags: ['items'] })
    expect(ops.length).toBe(1)
    expect(ops[0].key).toBe('get-items')
  })

  it('returns empty when no operation matches filter', () => {
    const ops = collectOperations(doc, { path: '/nonexistent' })
    expect(ops.length).toBe(0)
  })
})
