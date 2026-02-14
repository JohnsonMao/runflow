import type { FlowStep } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { closureIdsThatDependOnDone, computeBackwardClosure, computeLoopClosure } from './loopClosure'

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

describe('computeBackwardClosure', () => {
  it('returns target ids plus all transitive dependencies', () => {
    const steps: FlowStep[] = [
      step('A', []),
      step('B', ['A']),
      step('C', ['B']),
      step('D', ['C']),
    ]
    const back = computeBackwardClosure(steps, ['D'])
    expect([...back].sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('multiple targets merge ancestors', () => {
    const steps: FlowStep[] = [
      step('entry', []),
      step('L', ['entry']),
      step('R', ['entry']),
      step('noop', ['L']),
      step('nap2', ['R']),
    ]
    const back = computeBackwardClosure(steps, ['noop', 'nap2'])
    expect([...back].sort()).toEqual(['L', 'R', 'entry', 'nap2', 'noop'])
  })
})

describe('closureIdsThatDependOnDone', () => {
  it('returns done ids plus steps that transitively depend on done', () => {
    const steps: FlowStep[] = [
      step('loopBody', ['loop']),
      step('nap', ['loop']),
      step('req', ['nap']),
      step('sub', ['req']),
      step('summary', ['sub']),
    ]
    const closure = ['loopBody', 'nap', 'req', 'sub', 'summary']
    const excluded = closureIdsThatDependOnDone(steps, closure, ['nap'])
    expect([...excluded].sort()).toEqual(['nap', 'req', 'sub', 'summary'])
  })

  it('returns only done when no step in closure depends on done', () => {
    const steps: FlowStep[] = [
      step('body', ['loop']),
      step('after', ['loop']),
    ]
    const closure = ['body', 'after']
    const excluded = closureIdsThatDependOnDone(steps, closure, ['after'])
    expect([...excluded].sort()).toEqual(['after'])
  })
})
