import type { FlowDefinition } from './types'
import { describe, expect, it } from 'vitest'
import { flowDefinitionToGraph, flowGraphToJson, flowGraphToMermaid } from './flowGraph'

describe('flowDefinitionToGraph', () => {
  it('linear chain: two nodes and one edge', () => {
    const flow: FlowDefinition = {
      name: 'linear',
      steps: [
        { id: 'a', type: 'set', set: {}, dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['a'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.nodes).toHaveLength(2)
    expect(g.nodes.map(n => n.id)).toEqual(['a', 'b'])
    expect(g.nodes[0].type).toBe('set')
    expect(g.nodes[0].label).toBe('a (set)')
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toEqual({ source: 'a', target: 'b' })
    expect(g.flowName).toBe('linear')
  })

  it('parallel branches: one root, two children, two edges', () => {
    const flow: FlowDefinition = {
      name: 'parallel',
      steps: [
        { id: 'a', type: 'set', set: {}, dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['a'] },
        { id: 'c', type: 'http', url: '', dependsOn: ['a'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.nodes).toHaveLength(3)
    expect(g.edges).toHaveLength(2)
    expect(g.edges).toContainEqual({ source: 'a', target: 'b' })
    expect(g.edges).toContainEqual({ source: 'a', target: 'c' })
    const nodeB = g.nodes.find(n => n.id === 'b')
    const nodeC = g.nodes.find(n => n.id === 'c')
    expect(nodeB?.type).toBe('set')
    expect(nodeC?.type).toBe('http')
  })

  it('orphan steps are excluded from graph', () => {
    const flow: FlowDefinition = {
      name: 'with-orphan',
      steps: [
        { id: 'orphan', type: 'set', set: {} },
        { id: 'a', type: 'set', set: {}, dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['a'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.nodes.map(n => n.id)).toEqual(['a', 'b'])
    expect(g.nodes.some(n => n.id === 'orphan')).toBe(false)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0].source).not.toBe('orphan')
    expect(g.edges[0].target).not.toBe('orphan')
  })

  it('includes flowName and flowDescription when present', () => {
    const flow: FlowDefinition = {
      name: 'my-flow',
      description: 'A test flow',
      steps: [{ id: 'a', type: 'set', set: {}, dependsOn: [] }],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.flowName).toBe('my-flow')
    expect(g.flowDescription).toBe('A test flow')
  })

  it('multiple dependencies produce multiple edges', () => {
    const flow: FlowDefinition = {
      name: 'join',
      steps: [
        { id: 'a', type: 'set', set: {}, dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: [] },
        { id: 'c', type: 'set', set: {}, dependsOn: ['a', 'b'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.edges).toHaveLength(2)
    expect(g.edges).toContainEqual({ source: 'a', target: 'c' })
    expect(g.edges).toContainEqual({ source: 'b', target: 'c' })
  })

  it('uses step.name as node label when present', () => {
    const flow: FlowDefinition = {
      name: 'named',
      steps: [
        { id: 'fetch', type: 'http', name: 'Fetch user', dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['fetch'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    const nodeFetch = g.nodes.find(n => n.id === 'fetch')
    const nodeB = g.nodes.find(n => n.id === 'b')
    expect(nodeFetch?.label).toBe('Fetch user')
    expect(nodeB?.label).toBe('b (set)')
  })

  it('uses fallback label when step has no name', () => {
    const flow: FlowDefinition = {
      name: 'no-name',
      steps: [{ id: 'a', type: 'set', set: {}, dependsOn: [] }],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.nodes[0].label).toBe('a (set)')
  })

  it('sets node.description from step.description when present', () => {
    const flow: FlowDefinition = {
      name: 'with-desc',
      steps: [
        { id: 'a', type: 'set', set: {}, description: 'Initialize state.', dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['a'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    const nodeA = g.nodes.find(n => n.id === 'a')
    const nodeB = g.nodes.find(n => n.id === 'b')
    expect(nodeA?.description).toBe('Initialize state.')
    expect(nodeB?.description).toBeUndefined()
  })
})

describe('flowGraphToMermaid', () => {
  it('produces flowchart TB with nodes and edges', () => {
    const flow: FlowDefinition = {
      name: 'linear',
      steps: [
        { id: 'a', type: 'set', set: {}, dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['a'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    const m = flowGraphToMermaid(g)
    expect(m).toContain('flowchart TB')
    expect(m).toContain('["a (set)"]')
    expect(m).toContain('["b (set)"]')
    expect(m).toMatch(/a\s*-->\s*b/)
  })

  it('sanitizes node ids so Mermaid parser accepts them (e.g. init)', () => {
    const flow: FlowDefinition = {
      name: 'with-init',
      steps: [
        { id: 'init', type: 'set', set: {}, dependsOn: [] },
        { id: 'done', type: 'set', set: {}, dependsOn: ['init'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    const m = flowGraphToMermaid(g)
    expect(m).toContain('flowchart TB')
    expect(m).toContain('["init (set)"]')
    expect(m).toContain('["done (set)"]')
    expect(m).toMatch(/init\s*-->\s*done/)
    expect(m).not.toMatch(/"init"\s*\[/) // node id must be unquoted
  })
})

describe('flowGraphToJson', () => {
  it('returns object with nodes, edges, and optional metadata', () => {
    const flow: FlowDefinition = {
      name: 'my-flow',
      description: 'Desc',
      steps: [{ id: 'a', type: 'set', set: {}, dependsOn: [] }],
    }
    const g = flowDefinitionToGraph(flow)
    const out = flowGraphToJson(g)
    expect(out.nodes).toHaveLength(1)
    expect(out.nodes[0].id).toBe('a')
    expect(out.edges).toHaveLength(0)
    expect(out.flowName).toBe('my-flow')
    expect(out.flowDescription).toBe('Desc')
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
})
