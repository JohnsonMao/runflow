import type { FlowStep, StepContext } from '../types'
import { describe, expect, it } from 'vitest'
import { stepResult } from '../stepResult'
import { CommandHandler } from './command'

const noopRunSubFlow = async () => ({ results: [], newContext: {} })
const emptyContext: StepContext = { params: {}, runSubFlow: noopRunSubFlow, stepResult }

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
      const ctx: StepContext = { ...emptyContext, allowedCommands: ['pwd', 'echo'] }
      const step: FlowStep = { id: 'c1', type: 'command', run: 'pwd', cwd: '/tmp', dependsOn: [] }
      const result = await handler.run(step, ctx)
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

    it('allows command when allowedCommands is set and first token is in list', async () => {
      const ctx: StepContext = { ...emptyContext, allowedCommands: ['echo', 'node'] }
      const step: FlowStep = { id: 's1', type: 'command', run: 'echo ok', dependsOn: [] }
      const result = await handler.run(step, ctx)
      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('ok')
    })

    it('rejects command when allowedCommands is set and first token is not in list', async () => {
      const ctx: StepContext = { ...emptyContext, allowedCommands: ['node'] }
      const step: FlowStep = { id: 's1', type: 'command', run: 'echo hi', dependsOn: [] }
      const result = await handler.run(step, ctx)
      expect(result.success).toBe(false)
      expect(result.error).toContain('command not allowed')
      expect(result.error).toContain('Allowed: node')
    })

    it('when allowedCommands is empty array, rejects all commands', async () => {
      const ctx: StepContext = { ...emptyContext, allowedCommands: [] }
      const step: FlowStep = { id: 's1', type: 'command', run: 'echo hi', dependsOn: [] }
      const result = await handler.run(step, ctx)
      expect(result.success).toBe(false)
      expect(result.error).toContain('allowedCommands is empty')
    })

    it('when allowedCommands is undefined, uses default safe list (e.g. echo allowed)', async () => {
      const step: FlowStep = { id: 's1', type: 'command', run: 'echo ok', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('ok')
    })

    it('when allowedCommands is undefined, rejects command not in default list', async () => {
      const step: FlowStep = { id: 's1', type: 'command', run: 'curl -s example.com', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('command not allowed')
      expect(result.error).toContain('curl')
    })
  })
})
