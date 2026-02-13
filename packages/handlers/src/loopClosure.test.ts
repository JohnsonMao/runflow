import type { FlowStep } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { computeLoopClosure, inferLoopEndSinks } from './loopClosure'

function step(id: string, dependsOn: string[]): FlowStep {
  return { id, type: 'set', dependsOn }
}

describe('computeLoopClosure', () => {
  const LOOP = 'loop'

  it('single entry chain A→B→C→D', () => {
    const steps: FlowStep[] = [
      step('A', [LOOP]),
      step('B', ['A']),
      step('C', ['B']),
      step('D', ['C']),
    ]
    expect(computeLoopClosure(steps, ['A'], LOOP).sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('multiple entry with merge at D', () => {
    const steps: FlowStep[] = [
      step('A', [LOOP]),
      step('B', ['A']),
      step('C', ['B']),
      step('G', [LOOP]),
      step('H', ['G']),
      step('D', ['C', 'H']),
    ]
    const closure = computeLoopClosure(steps, ['A', 'G'], LOOP).sort()
    expect(closure).toEqual(['A', 'B', 'C', 'D', 'G', 'H'])
  })

  it('empty entry returns empty closure when no step has deps only loop or in-scope', () => {
    const steps: FlowStep[] = [step('A', [LOOP, 'x'])]
    expect(computeLoopClosure(steps, [], LOOP)).toEqual([])
  })

  it('invalid entry id not in flow is omitted; valid entry yields closure', () => {
    const steps: FlowStep[] = [
      step('A', [LOOP]),
      step('B', ['A']),
    ]
    expect(computeLoopClosure(steps, ['Missing', 'A'], LOOP).sort()).toEqual(['A', 'B'])
  })
})

describe('inferLoopEndSinks', () => {
  it('single sink', () => {
    const steps: FlowStep[] = [
      step('A', ['loop']),
      step('B', ['A']),
      step('C', ['B']),
    ]
    expect(inferLoopEndSinks(steps, ['A', 'B', 'C'])).toEqual(['C'])
  })

  it('multiple sinks', () => {
    const steps: FlowStep[] = [
      step('A', ['loop']),
      step('B', ['A']),
      step('C', ['A']),
    ]
    expect(inferLoopEndSinks(steps, ['A', 'B', 'C']).sort()).toEqual(['B', 'C'])
  })
})
