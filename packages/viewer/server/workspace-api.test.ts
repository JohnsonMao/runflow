import type { DiscoverEntry } from '@runflow/workspace'
import { buildTreeFromCatalog } from '@runflow/workspace'
import { describe, expect, it } from 'vitest'

describe('buildTreeFromCatalog', () => {
  it('builds file nodes for path-like flowIds', () => {
    const catalog: DiscoverEntry[] = [
      { flowId: 'flows/hello.yaml', name: 'Hello', path: 'flows/hello.yaml' },
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
    const catalog: DiscoverEntry[] = [
      { flowId: 'pet-get', name: 'Get pet' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('file')
    expect(tree[0].flowId).toBe('pet-get')
    expect(tree[0].label).toBe('Get pet')
  })

  it('groups openapi flows by handler key when flowId is handlerKey:operationKey', () => {
    const catalog: DiscoverEntry[] = [
      { flowId: 'pet:get', name: 'Get', handlerKey: 'pet', originalFlowId: 'pet:get' },
      { flowId: 'pet:list', name: 'List', handlerKey: 'pet', originalFlowId: 'pet:list' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('openapi:pet')
    expect(tree[0].type).toBe('folder')
    expect(tree[0].children).toHaveLength(2)
  })
})
