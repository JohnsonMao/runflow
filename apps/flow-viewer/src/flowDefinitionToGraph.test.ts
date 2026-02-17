import type { FlowDefinitionInput } from './flowDefinitionToGraph'
import { describe, expect, it } from 'vitest'
import { flowDefinitionToGraph, getNodeShape } from './flowDefinitionToGraph'

describe('flowDefinitionToGraph', () => {
  it('linear chain: two nodes and one edge (flow-graph-format minimal)', () => {
    const flow: FlowDefinitionInput = {
      name: 'linear',
      steps: [
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'b', type: 'set', dependsOn: ['a'] },
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
    const flow: FlowDefinitionInput = {
      name: 'parallel',
      steps: [
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'b', type: 'set', dependsOn: ['a'] },
        { id: 'c', type: 'http', dependsOn: ['a'] },
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
    const flow: FlowDefinitionInput = {
      name: 'with-orphan',
      steps: [
        { id: 'orphan', type: 'set' },
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'b', type: 'set', dependsOn: ['a'] },
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
    const flow: FlowDefinitionInput = {
      name: 'my-flow',
      description: 'A test flow',
      steps: [{ id: 'a', type: 'set', dependsOn: [] }],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.flowName).toBe('my-flow')
    expect(g.flowDescription).toBe('A test flow')
  })

  it('multiple dependencies produce multiple edges', () => {
    const flow: FlowDefinitionInput = {
      name: 'join',
      steps: [
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'b', type: 'set', dependsOn: [] },
        { id: 'c', type: 'set', dependsOn: ['a', 'b'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.edges).toHaveLength(2)
    expect(g.edges).toContainEqual({ source: 'a', target: 'c' })
    expect(g.edges).toContainEqual({ source: 'b', target: 'c' })
  })

  it('label fallback when no type: id only', () => {
    const flow: FlowDefinitionInput = {
      name: 'no-type',
      steps: [{ id: 'a', dependsOn: [] }],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.nodes[0].label).toBe('a')
  })

  it('condition step: then/else edge kinds', () => {
    const flow: FlowDefinitionInput = {
      name: 'cond',
      steps: [
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'cond', type: 'condition', dependsOn: ['a'], then: ['t'], else: ['e'] },
        { id: 't', type: 'set', dependsOn: ['cond'] },
        { id: 'e', type: 'set', dependsOn: ['cond'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.edges).toContainEqual({ source: 'cond', target: 't', kind: 'then' })
    expect(g.edges).toContainEqual({ source: 'cond', target: 'e', kind: 'else' })
    const condNode = g.nodes.find(n => n.id === 'cond')
    expect(condNode?.shape).toBe('decision')
  })

  it('loop step: done edge kind and loopBack from connect', () => {
    const flow: FlowDefinitionInput = {
      name: 'loop',
      steps: [
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'loop', type: 'loop', dependsOn: ['a'], done: ['b'], connect: ['a'] },
        { id: 'b', type: 'set', dependsOn: ['loop'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.edges).toContainEqual({ source: 'loop', target: 'b', kind: 'done' })
    expect(g.edges).toContainEqual({ source: 'a', target: 'loop', kind: 'loopBack' })
    const loopNode = g.nodes.find(n => n.id === 'loop')
    expect(loopNode?.shape).toBe('loop')
  })

  it('loop with end (fallback for connect): loopBack still added', () => {
    const flow: FlowDefinitionInput = {
      name: 'loop-end',
      steps: [
        { id: 'a', type: 'set', dependsOn: [] },
        { id: 'loop', type: 'loop', dependsOn: ['a'], done: ['b'], end: ['a'] },
        { id: 'b', type: 'set', dependsOn: ['loop'] },
      ],
    }
    const g = flowDefinitionToGraph(flow)
    expect(g.edges).toContainEqual({ source: 'a', target: 'loop', kind: 'loopBack' })
  })
})

describe('getNodeShape', () => {
  const dagEdges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ]

  it('node with no incoming edges → start', () => {
    const shape = getNodeShape({ id: 'a', type: 'set', label: 'a (set)' }, dagEdges)
    expect(shape).toBe('start')
  })

  it('node with no outgoing edges and not in connectSourceIds → end', () => {
    const shape = getNodeShape({ id: 'c', type: 'set', label: 'c (set)' }, dagEdges)
    expect(shape).toBe('end')
  })

  it('node with both in and out → process', () => {
    const shape = getNodeShape({ id: 'b', type: 'set', label: 'b (set)' }, dagEdges)
    expect(shape).toBe('process')
  })

  it('condition type → decision', () => {
    const shape = getNodeShape({ id: 'x', type: 'condition', label: 'x (condition)' }, [])
    expect(shape).toBe('decision')
  })

  it('label contains (condition) → decision', () => {
    const shape = getNodeShape({ id: 'x', label: 'foo (condition)' }, [])
    expect(shape).toBe('decision')
  })

  it('loop type → loop', () => {
    const shape = getNodeShape({ id: 'l', type: 'loop', label: 'l (loop)' }, [])
    expect(shape).toBe('loop')
  })

  it('node with no outgoing but in connectSourceIds → process', () => {
    // Node a has one incoming, zero outgoing in DAG; it is loop-back source so shown as process
    const dagEdgesWithIn = [{ source: 'x', target: 'a' }]
    const shape = getNodeShape(
      { id: 'a', type: 'set', label: 'a (set)' },
      dagEdgesWithIn,
      new Set(['a']),
    )
    expect(shape).toBe('process')
  })
})
