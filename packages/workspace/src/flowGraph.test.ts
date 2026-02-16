import type { FlowDefinition } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { flowDefinitionToGraphForVisualization } from './flowGraph'

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
