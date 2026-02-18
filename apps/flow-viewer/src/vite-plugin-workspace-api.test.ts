import type { DiscoverEntryLike } from './vite-plugin-workspace-api'
import { describe, expect, it } from 'vitest'
import { buildTreeFromCatalog, matchOpenApiPrefixFallback } from './vite-plugin-workspace-api'

describe('matchOpenApiPrefixFallback', () => {
  it('returns longest matching prefix when flowId starts with prefix-', () => {
    expect(matchOpenApiPrefixFallback('pet-get-dog', ['pet', 'pet-get'])).toBe('pet-get')
    expect(matchOpenApiPrefixFallback('pet-get-dog', ['pet-get', 'pet'])).toBe('pet-get')
  })

  it('returns null when no prefix matches', () => {
    expect(matchOpenApiPrefixFallback('other-flow', ['pet', 'user'])).toBe(null)
  })

  it('returns null for empty prefixes', () => {
    expect(matchOpenApiPrefixFallback('pet-get', [])).toBe(null)
  })
})

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

  it('puts openapi-like flowIds (no path) in roots', () => {
    const catalog: DiscoverEntryLike[] = [
      { flowId: 'pet-get', name: 'Get pet' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('file')
    expect(tree[0].flowId).toBe('pet-get')
    expect(tree[0].label).toBe('Get pet')
  })

  it('groups openapi flows by prefix when multiple share prefix', () => {
    const catalog: DiscoverEntryLike[] = [
      { flowId: 'pet-get', name: 'Get', openapiPrefix: 'pet' },
      { flowId: 'pet-list', name: 'List', openapiPrefix: 'pet' },
    ]
    const tree = buildTreeFromCatalog(catalog)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('openapi:pet')
    expect(tree[0].type).toBe('folder')
    expect(tree[0].children).toHaveLength(2)
  })
})
