import type { DiscoverEntryLike } from './vite-plugin-workspace-api'
import { describe, expect, it } from 'vitest'
import { buildTreeFromCatalog } from './vite-plugin-workspace-api'

describe('buildTreeFromCatalog', () => {
  it('builds file nodes for path-like flowIds', () => {
    const catalog: DiscoverEntryLike[] = [
      { flowId: 'flows/hello.yaml', name: 'Hello' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('folder')
    expect(tree[0].label).toBe('flows')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children![0].type).toBe('file')
    expect(tree[0].children![0].flowId).toBe('flows/hello.yaml')
    expect(tree[0].children![0].label).toBe('hello.yaml')
  })

  it('puts openapi-like flowId without colon as single file node', () => {
    const catalog: DiscoverEntryLike[] = [
      { flowId: 'pet-get', name: 'Get pet' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('file')
    expect(tree[0].flowId).toBe('pet-get')
    expect(tree[0].label).toBe('Get pet')
  })

  it('groups openapi flows by handler key when flowId is handlerKey:operationKey', () => {
    const catalog: DiscoverEntryLike[] = [
      { flowId: 'pet:get', name: 'Get' },
      { flowId: 'pet:list', name: 'List' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('openapi:pet')
    expect(tree[0].type).toBe('folder')
    expect(tree[0].children).toHaveLength(2)
  })
})
