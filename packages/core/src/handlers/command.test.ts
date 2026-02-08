import type { FlowStep, StepContext } from '../types'
import { describe, expect, it } from 'vitest'
import { CommandHandler } from './command'

const emptyContext: StepContext = { params: {} }

describe('command handler', () => {
  const handler = new CommandHandler()

  describe('validate', () => {
    it('returns true when step has run (string)', () => {
      const step: FlowStep = { id: 'c1', type: 'command', run: 'echo hi', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has no run', () => {
      const step: FlowStep = { id: 'c1', type: 'command', dependsOn: [] }
      expect(handler.validate(step)).toBe('command step requires run (string)')
    })
  })

  describe('run', () => {
    it('captures stdout and success on exit 0', async () => {
      const step: FlowStep = { id: 's1', type: 'command', run: 'echo hello', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.stepId).toBe('s1')
      expect(result.stdout.trim()).toBe('hello')
      expect(result.stderr).toBe('')
    })

    it('reports failure when command exits non-zero', async () => {
      const step: FlowStep = { id: 's1', type: 'command', run: 'exit 42', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('runs in given cwd when step.cwd is set', async () => {
      const step: FlowStep = { id: 'c1', type: 'command', run: 'pwd', cwd: '/tmp', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toContain('tmp')
    })

    it('sees env vars when step.env is set', async () => {
      const step: FlowStep = {
        id: 'c1',
        type: 'command',
        run: 'echo $MY_VAR',
        env: { MY_VAR: 'hello' },
        dependsOn: [],
      }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('hello')
    })

    it('returns error when run is missing at run time', async () => {
      const step = { id: 's1', type: 'command', dependsOn: [] } as FlowStep
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('command step requires run')
    })
  })
})
