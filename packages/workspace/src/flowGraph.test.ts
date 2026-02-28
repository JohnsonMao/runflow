import type { FlowDefinition } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { flowDefinitionToGraph, flowDefinitionToGraphForVisualization, flowGraphToJson, flowGraphToMermaid } from './flowGraph'

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

  it('uses step.name as node label when present', () => {
    const flow: FlowDefinition = {
      name: 'named',
      steps: [
        { id: 'fetch', type: 'http', name: 'Fetch user', dependsOn: [] },
        { id: 'b', type: 'set', set: {}, dependsOn: ['fetch'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.nodes.find(n => n.id === 'fetch')?.label).toBe('Fetch user')
    expect(g.nodes.find(n => n.id === 'b')?.label).toBe('b (set)')
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
    expect(g.nodes.find(n => n.id === 'a')?.description).toBe('Initialize state.')
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
  })
})

describe('flowDefinitionToGraphForVisualization', () => {
  it('adds loop back edges from connect step to loop step', () => {
    const flow: FlowDefinition = {
      name: 'with-loop',
      steps: [
        { id: 'init', type: 'set', set: {}, dependsOn: [] },
        { id: 'loop', type: 'loop', count: 2, entry: ['body'], connect: ['body'], dependsOn: ['init'] },
        { id: 'body', type: 'set', set: {}, dependsOn: ['loop'] },
        { id: 'done', type: 'set', set: {}, dependsOn: ['loop'] },
      ],
    }
    const graph = flowDefinitionToGraphForVisualization(flow)
    const backEdge = graph.edges.find(e => e.source === 'body' && e.target === 'loop')
    expect(backEdge).toBeDefined()
    expect(graph.edges).toContainEqual({ source: 'body', target: 'loop', kind: 'loopBack' })
  })

  it('supports end when connect is absent', () => {
    const flow: FlowDefinition = {
      name: 'loop-end',
      steps: [
        { id: 'loop', type: 'loop', count: 1, entry: ['a'], end: ['a'], dependsOn: [] },
        { id: 'a', type: 'set', set: {}, dependsOn: ['loop'] },
      ],
    }
    const graph = flowDefinitionToGraphForVisualization(flow)
    expect(graph.edges).toContainEqual({ source: 'a', target: 'loop', kind: 'loopBack' })
  })

  it('does not add edge when connect step is not in graph', () => {
    const flow: FlowDefinition = {
      name: 'orphan-connect',
      steps: [
        { id: 'loop', type: 'loop', count: 1, entry: ['x'], connect: ['orphan'], dependsOn: [] },
        { id: 'x', type: 'set', set: {}, dependsOn: ['loop'] },
      ],
    }
    const graph = flowDefinitionToGraphForVisualization(flow)
    expect(graph.edges.some(e => e.target === 'loop' && e.source === 'orphan')).toBe(false)
  })

  it('adds loopBack from multiple connect nodes and gives them shape process', () => {
    const flow: FlowDefinition = {
      name: 'multi-connect',
      steps: [
        { id: 'loop', type: 'loop', count: 1, entry: ['a'], connect: ['A3', 'nodeB'], dependsOn: [] },
        { id: 'a', type: 'set', set: {}, dependsOn: ['loop'] },
        { id: 'A3', type: 'set', set: {}, dependsOn: ['a'] },
        { id: 'nodeB', type: 'set', set: {}, dependsOn: ['a'] },
      ],
    }
    const graph = flowDefinitionToGraphForVisualization(flow)
    expect(graph.edges).toContainEqual({ source: 'A3', target: 'loop', kind: 'loopBack' })
    expect(graph.edges).toContainEqual({ source: 'nodeB', target: 'loop', kind: 'loopBack' })
    expect(graph.nodes.find(n => n.id === 'A3')?.shape).toBe('process')
    expect(graph.nodes.find(n => n.id === 'nodeB')?.shape).toBe('process')
  })

  it('merges connect and end so both get loopBack and shape process', () => {
    const flow: FlowDefinition = {
      name: 'connect-and-end',
      steps: [
        { id: 'loop', type: 'loop', count: 1, entry: ['a'], connect: ['A3'], end: ['nodeB'], dependsOn: [] },
        { id: 'a', type: 'set', set: {}, dependsOn: ['loop'] },
        { id: 'A3', type: 'set', set: {}, dependsOn: ['a'] },
        { id: 'nodeB', type: 'set', set: {}, dependsOn: ['a'] },
      ],
    }
    const graph = flowDefinitionToGraphForVisualization(flow)
    expect(graph.edges).toContainEqual({ source: 'A3', target: 'loop', kind: 'loopBack' })
    expect(graph.edges).toContainEqual({ source: 'nodeB', target: 'loop', kind: 'loopBack' })
    expect(graph.nodes.find(n => n.id === 'A3')?.shape).toBe('process')
    expect(graph.nodes.find(n => n.id === 'nodeB')?.shape).toBe('process')
  })
})
