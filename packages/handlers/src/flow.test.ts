import type { FlowStep, RunResult, StepContext } from '@runflow/core'
import { stepResult } from '@runflow/core'
import { describe, expect, it } from 'vitest'
import { FlowHandler } from './flow'

const noopRunSubFlow = async () => ({ results: [], newContext: {} })

function ctx(runFlow?: StepContext['runFlow']) {
  return {
    params: {},
    flowFilePath: undefined,
    runSubFlow: noopRunSubFlow,
    stepResult,
    runFlow,
  } as StepContext
}

describe('flow handler', () => {
  const handler = new FlowHandler()

  describe('validate', () => {
    it('returns true when step has flow string and optional params object', () => {
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
      expect(handler.validate({ ...step, params: { a: 1 } })).toBe(true)
    })

    it('returns error when flow is missing', () => {
      const step: FlowStep = { id: 'f1', type: 'flow', dependsOn: [] }
      expect(handler.validate(step)).toMatch(/flow.*required|non-empty string/)
    })

    it('returns error when flow is not a string', () => {
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 123, dependsOn: [] } as unknown as FlowStep
      expect(handler.validate(step)).toMatch(/flow.*required|non-empty string/)
    })

    it('returns error when flow is empty string', () => {
      const step: FlowStep = { id: 'f1', type: 'flow', flow: '  ', dependsOn: [] }
      expect(handler.validate(step)).not.toBe(true)
    })

    it('returns error when params is not an object', () => {
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'x.yaml', params: 'invalid', dependsOn: [] } as unknown as FlowStep
      expect(handler.validate(step)).toMatch(/params.*object/)
    })
  })

  describe('run', () => {
    it('returns error when runFlow is not available', async () => {
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }
      const result = await handler.run(step, ctx(undefined))
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/runFlow not available/)
    })

    it('calls runFlow with path and params and returns success with merged outputs', async () => {
      const runFlow = async (_path: string, _params: Record<string, unknown>): Promise<RunResult> => ({
        flowName: 'sub',
        success: true,
        steps: [
          stepResult('a', true, { outputs: { k: 'v1' } }),
          stepResult('b', true, { outputs: { k: 'v2', x: 1 } }),
        ],
      })
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', params: { a: 1 }, dependsOn: [] }
      const result = await handler.run(step, ctx(runFlow))
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ k: 'v2', x: 1 })
    })

    it('returns failure when runFlow returns success: false', async () => {
      const runFlow = async (): Promise<RunResult> => ({
        flowName: 'sub',
        success: false,
        steps: [],
        error: 'callee flow failed',
      })
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }
      const result = await handler.run(step, ctx(runFlow))
      expect(result.success).toBe(false)
      expect(result.error).toBe('callee flow failed')
    })

    it('returns failure when runFlow throws', async () => {
      const runFlow = async (): Promise<RunResult> => {
        throw new Error('load error')
      }
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }
      const result = await handler.run(step, ctx(runFlow))
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/load error/)
    })

    it('passes params from step to runFlow', async () => {
      let capturedParams: Record<string, unknown> = {}
      const runFlow = async (_path: string, params: Record<string, unknown>): Promise<RunResult> => {
        capturedParams = params
        return { flowName: 'sub', success: true, steps: [] }
      }
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', params: { a: 1, b: 'two' }, dependsOn: [] }
      await handler.run(step, ctx(runFlow))
      expect(capturedParams).toEqual({ a: 1, b: 'two' })
    })

    it('passes empty object when step has no params', async () => {
      let capturedParams: Record<string, unknown> = { notEmpty: true }
      const runFlow = async (_path: string, params: Record<string, unknown>): Promise<RunResult> => {
        capturedParams = params
        return { flowName: 'sub', success: true, steps: [] }
      }
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', dependsOn: [] }
      await handler.run(step, ctx(runFlow))
      expect(capturedParams).toEqual({})
    })

    it('returns validation error in StepResult when callee params validation fails', async () => {
      const runFlow = async (): Promise<RunResult> => ({
        flowName: 'sub',
        success: false,
        steps: [],
        error: 'a: Required',
      })
      const step: FlowStep = { id: 'f1', type: 'flow', flow: 'sub.yaml', params: {}, dependsOn: [] }
      const result = await handler.run(step, ctx(runFlow))
      expect(result.success).toBe(false)
      expect(result.error).toBe('a: Required')
    })
  })
})
