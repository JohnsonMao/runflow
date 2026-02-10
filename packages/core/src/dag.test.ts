import type { FlowStep } from './types'
import { describe, expect, it } from 'vitest'
import { buildDAG, getDAGStepIds, topologicalSort } from './dag'

describe('buildDAG', () => {
  it('excludes steps with no dependsOn (orphans)', () => {
    const steps: FlowStep[] = [
      { id: 'a', type: 'set', set: {} },
      { id: 'b', type: 'set', set: {}, dependsOn: [] },
    ]
    const g = buildDAG(steps)
    expect(g.has('a')).toBe(false)
    expect(g.has('b')).toBe(true)
    expect(g.get('b')).toEqual([])
  })

  it('includes steps with dependsOn: [] as roots', () => {
    const steps: FlowStep[] = [
      { id: 'root', type: 'set', set: {}, dependsOn: [] },
    ]
    const g = buildDAG(steps)
    expect(g.get('root')).toEqual([])
  })

  it('records dependencies', () => {
    const steps: FlowStep[] = [
      { id: 'a', type: 'c', dependsOn: [] },
      { id: 'b', type: 'c', dependsOn: ['a'] },
    ]
    const g = buildDAG(steps)
    expect(g.get('a')).toEqual([])
    expect(g.get('b')).toEqual(['a'])
  })
})

describe('getDAGStepIds', () => {
  it('returns only ids that have dependsOn', () => {
    const steps: FlowStep[] = [
      { id: 'orphan', type: 'c' },
      { id: 'in', type: 'c', dependsOn: [] },
    ]
    const ids = getDAGStepIds(steps)
    expect(ids.has('orphan')).toBe(false)
    expect(ids.has('in')).toBe(true)
  })
})

describe('topologicalSort', () => {
  it('linear chain', () => {
    const steps: FlowStep[] = [
      { id: 'a', type: 'c', dependsOn: [] },
      { id: 'b', type: 'c', dependsOn: ['a'] },
      { id: 'c', type: 'c', dependsOn: ['b'] },
    ]
    const r = topologicalSort(steps)
    expect(r.ok).toBe(true)
    if (r.ok)
      expect(r.order).toEqual(['a', 'b', 'c'])
  })

  it('parallel branches', () => {
    const steps: FlowStep[] = [
      { id: 'a', type: 'c', dependsOn: [] },
      { id: 'b', type: 'c', dependsOn: ['a'] },
      { id: 'c', type: 'c', dependsOn: ['a'] },
    ]
    const r = topologicalSort(steps)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.order[0]).toBe('a')
      expect(r.order).toContain('b')
      expect(r.order).toContain('c')
      expect(r.order).toHaveLength(3)
    }
  })

  it('cycle detection', () => {
    const steps: FlowStep[] = [
      { id: 'a', type: 'c', dependsOn: ['c'] },
      { id: 'b', type: 'c', dependsOn: ['a'] },
      { id: 'c', type: 'c', dependsOn: ['b'] },
    ]
    const r = topologicalSort(steps)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.error).toContain('Cycle')
  })

  it('orphan exclusion: only steps with dependsOn are in order', () => {
    const steps: FlowStep[] = [
      { id: 'orphan', type: 'c' },
      { id: 'a', type: 'c', dependsOn: [] },
      { id: 'b', type: 'c', dependsOn: ['a'] },
    ]
    const r = topologicalSort(steps)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.order).not.toContain('orphan')
      expect(r.order).toEqual(['a', 'b'])
    }
  })

  it('empty dependsOn as root', () => {
    const steps: FlowStep[] = [
      { id: 'root', type: 'c', dependsOn: [] },
      { id: 'child', type: 'c', dependsOn: ['root'] },
    ]
    const r = topologicalSort(steps)
    expect(r.ok).toBe(true)
    if (r.ok)
      expect(r.order).toEqual(['root', 'child'])
  })

  it('missing dependency (depends on non-DAG id) returns error', () => {
    const steps: FlowStep[] = [
      { id: 'a', type: 'c' },
      { id: 'b', type: 'c', dependsOn: ['a'] },
    ]
    const r = topologicalSort(steps)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.error).toMatch(/not in the DAG|orphan/)
  })
})
