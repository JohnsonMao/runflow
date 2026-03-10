import type { FlowGraph } from './types'
import { describe, expect, it } from 'vitest'
import { layoutGraph } from './layout'

describe('layoutGraph', () => {
  it('returns one position per node for linear graph', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', label: 'a (set)' },
        { id: 'b', label: 'b (set)' },
      ],
      edges: [{ source: 'a', target: 'b' }],
    }
    const positions = layoutGraph(graph)
    expect(positions.size).toBe(2)
    expect(positions.has('a')).toBe(true)
    expect(positions.has('b')).toBe(true)
    const posA = positions.get('a')!
    const posB = positions.get('b')!
    expect(typeof posA.x).toBe('number')
    expect(typeof posA.y).toBe('number')
    expect(typeof posB.x).toBe('number')
    expect(typeof posB.y).toBe('number')
    // Top-down: first node above second
    expect(posA.y).toBeLessThan(posB.y)
  })

  it('returns positions for parallel branches', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'c', label: 'c' },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
    }
    const positions = layoutGraph(graph)
    expect(positions.size).toBe(3)
    expect(positions.has('a')).toBe(true)
    expect(positions.has('b')).toBe(true)
    expect(positions.has('c')).toBe(true)
  })

  it('places else-branch left of then-branch when same rank (condition)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', label: 'a' },
        { id: 'cond', label: 'cond (condition)' },
        { id: 't', label: 'then' },
        { id: 'e', label: 'else' },
      ],
      edges: [
        { source: 'a', target: 'cond' },
        { source: 'cond', target: 't', kind: 'then' },
        { source: 'cond', target: 'e', kind: 'else' },
      ],
    }
    const positions = layoutGraph(graph)
    expect(positions.size).toBe(4)
    const posThen = positions.get('t')!
    const posElse = positions.get('e')!
    // applyElseLeftThenRight: else should be left (smaller x) when same rank
    const sameRank = Math.abs(posThen.y - posElse.y) <= 2
    if (sameRank) {
      expect(posElse.x).toBeLessThanOrEqual(posThen.x)
    }
  })

  it('handles graph with loopBack edge (DAG edges only for layout)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'a', label: 'a' },
        { id: 'loop', label: 'loop (loop)' },
        { id: 'b', label: 'b' },
      ],
      edges: [
        { source: 'a', target: 'loop' },
        { source: 'loop', target: 'b', kind: 'done' },
        { source: 'a', target: 'loop', kind: 'loopBack' },
      ],
    }
    const positions = layoutGraph(graph)
    expect(positions.size).toBe(3)
    expect(positions.has('a')).toBe(true)
    expect(positions.has('loop')).toBe(true)
    expect(positions.has('b')).toBe(true)
  })
})
