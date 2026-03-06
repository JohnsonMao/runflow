import type { RunResult } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { formatRunResult } from './format'

describe('formatRunResult', () => {
  it('hides successful steps with no log', () => {
    const result: RunResult = {
      success: true,
      steps: [
        { stepId: 's1', name: 'Step 1', success: true }, // Should be hidden
        { stepId: 's2', name: 'Step 2', success: true, log: 'some log' }, // Should be shown
        { stepId: 's3', name: 'Step 3', success: false, error: 'some error' }, // Should be shown
      ],
    }
    const output = formatRunResult(result, 'Test Flow')
    expect(output).toContain('**Success** — Flow "Test Flow"')
    expect(output).not.toContain('Step 1')
    expect(output).toContain('✓ Step 2 — some log')
    expect(output).toContain('✗ Step 3 — some error')
  })

  it('formats iteration labels and uses name', () => {
    const result: RunResult = {
      success: true,
      steps: [
        { stepId: 'loop.iteration_1', success: true }, // Marker hidden
        { stepId: 'loop.iteration_1.s1', name: 'Inside Loop', success: true, log: 'working' },
      ],
    }
    const output = formatRunResult(result)
    expect(output).not.toContain('loop [iteration 1]')
    expect(output).toContain('✓ [Iteration 1] Inside Loop — working')
  })

  it('handles nested iterations without name', () => {
    const result: RunResult = {
      success: true,
      steps: [
        { stepId: 'a.iteration_1.b.iteration_2.c', success: true, log: 'deep' },
      ],
    }
    const output = formatRunResult(result)
    expect(output).toContain('✓ [Iteration 1] [Iteration 2] c — deep')
  })

  it('shows all failed steps regardless of log', () => {
    const result: RunResult = {
      success: false,
      steps: [
        { stepId: 's1', success: false, error: 'fail' },
      ],
    }
    const output = formatRunResult(result)
    expect(output).toContain('**Failed**')
    expect(output).toContain('✗ s1 — fail')
  })

  it('handles empty steps', () => {
    const result: RunResult = { success: true, steps: [] }
    const output = formatRunResult(result)
    expect(output).toBe('**Success** — Flow "Flow"')
  })

  it('shows global error if no steps', () => {
    const result: RunResult = { success: false, steps: [], error: 'pre-run fail' }
    const output = formatRunResult(result)
    expect(output).toContain('Error: pre-run fail')
  })
})
