import type { FlowGraphInput } from './types'
import { describe, expect, it } from 'vitest'
import { graphToReactFlow, nodeType } from './flowGraphToReactFlow'

describe('nodeType', () => {
  it('maps decision → decision', () => {
    expect(nodeType('decision')).toBe('decision')
  })
  it('maps loop → loop', () => {
    expect(nodeType('loop')).toBe('loop')
  })
  it('maps start/end → startEnd', () => {
    expect(nodeType('start')).toBe('startEnd')
    expect(nodeType('end')).toBe('startEnd')
  })
  it('maps process/undefined → process', () => {
    expect(nodeType('process')).toBe('process')
    expect(nodeType()).toBe('process')
  })
})

describe('graphToReactFlow', () => {
  it('returns nodes and edges for linear graph', () => {
    const graph: FlowGraphInput = {
      nodes: [
        { id: 'a', label: 'a (set)', shape: 'start' },
        { id: 'b', label: 'b (set)', shape: 'process' },
        { id: 'c', label: 'c (set)', shape: 'end' },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    }
    const { nodes, edges } = graphToReactFlow(graph)
    expect(nodes).toHaveLength(3)
    expect(nodes.map(n => n.id)).toEqual(['a', 'b', 'c'])
    expect(nodes.map(n => n.type)).toEqual(['startEnd', 'process', 'startEnd'])
    expect(edges).toHaveLength(2)
    expect(edges[0].source).toBe('a')
    expect(edges[0].target).toBe('b')
    expect(edges[1].source).toBe('b')
    expect(edges[1].target).toBe('c')
  })

  it('assigns then/else handles for decision edges', () => {
    const graph: FlowGraphInput = {
      nodes: [
        { id: 'a', shape: 'start' },
        { id: 'cond', shape: 'decision' },
        { id: 't', shape: 'process' },
        { id: 'e', shape: 'process' },
      ],
      edges: [
        { source: 'a', target: 'cond' },
        { source: 'cond', target: 't', kind: 'then' },
        { source: 'cond', target: 'e', kind: 'else' },
      ],
    }
    const { edges } = graphToReactFlow(graph)
    const toT = edges.find(e => e.target === 't')
    const toE = edges.find(e => e.target === 'e')
    expect(toT?.sourceHandle).toBe('then')
    expect(toE?.sourceHandle).toBe('else')
  })

  it('assigns loop handles and smoothstep for loopBack', () => {
    const graph: FlowGraphInput = {
      nodes: [
        { id: 'a', shape: 'process' },
        { id: 'loop', shape: 'loop' },
        { id: 'b', shape: 'end' },
      ],
      edges: [
        { source: 'a', target: 'loop' },
        { source: 'loop', target: 'b', kind: 'done' },
        { source: 'a', target: 'loop', kind: 'loopBack' },
      ],
    }
    const { nodes, edges } = graphToReactFlow(graph)
    const doneEdge = edges.find(e => e.target === 'b' && e.sourceHandle === 'done')
    const backEdge = edges.find(e => e.type === 'smoothstep')
    expect(doneEdge?.sourceHandle).toBe('done')
    expect(backEdge?.className).toBe('flow-edge-loop-back')
    expect(nodes.every(n => n.position.x !== undefined && n.position.y !== undefined)).toBe(true)
  })
})
