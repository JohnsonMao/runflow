import type { FlowDefinition } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { applyHooks } from './applyHooks.js'

describe('applyHooks', () => {
  it('returns flow unchanged when no http step in flow', () => {
    const flow: FlowDefinition = {
      name: 'no-http',
      steps: [
        { id: 's1', type: 'set', set: {}, dependsOn: [] },
      ],
    }
    const result = applyHooks(flow, 'get-users', {
      before: [{ type: 'set', set: {} }],
      after: [{ type: 'set', set: {} }],
    })
    expect(result).toBe(flow)
    expect(result.steps).toHaveLength(1)
  })

  it('inserts before/after steps and sets api step dependsOn on before ids', () => {
    const flow: FlowDefinition = {
      name: 'api-flow',
      steps: [
        { id: 'http1', type: 'http', url: 'https://example.com', dependsOn: [] },
      ],
    }
    const result = applyHooks(flow, 'get-users', {
      before: [{ type: 'set', set: {} }, { type: 'set', set: { x: 1 } }],
      after: [{ type: 'set', set: {} }],
    })
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0].type).toBe('set')
    expect(result.steps[1].type).toBe('set')
    expect(result.steps[2].type).toBe('http')
    expect(result.steps[3].type).toBe('set')
    expect((result.steps[2] as { dependsOn?: string[] }).dependsOn).toEqual([result.steps[0].id, result.steps[1].id])
    expect((result.steps[3] as { dependsOn?: string[] }).dependsOn).toContain('http1')
  })

  it('merges user dependsOn on after step with api step id', () => {
    const flow: FlowDefinition = {
      name: 'api-flow',
      steps: [
        { id: 'http1', type: 'http', url: 'https://example.com', dependsOn: [] },
      ],
    }
    const result = applyHooks(flow, 'get-users', {
      after: [{ type: 'set', set: {}, dependsOn: ['other'] }],
    })
    const afterStep = result.steps[1] as { dependsOn?: string[] }
    expect(afterStep.dependsOn).toContain('http1')
    expect(afterStep.dependsOn).toContain('other')
  })
})
