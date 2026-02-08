import type { FlowStep, StepContext } from '../types'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { stepResult } from '../stepResult'
import { JsHandler } from './js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const noopRunSubFlow = async () => ({ results: [], newContext: {} })
const emptyContext: StepContext = { params: {}, runSubFlow: noopRunSubFlow, stepResult }

describe('js handler', () => {
  const handler = new JsHandler()

  describe('validate', () => {
    it('returns true when step has run', () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'return 1', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns true when step has file', () => {
      const step: FlowStep = { id: 'j1', type: 'js', file: 'step.js', dependsOn: [] }
      expect(handler.validate(step)).toBe(true)
    })

    it('returns error when step has neither run nor file', () => {
      const step: FlowStep = { id: 'j1', type: 'js', dependsOn: [] }
      expect(handler.validate(step)).toBe('js step requires run or file (string)')
    })
  })

  describe('run', () => {
    it('captures console.log to stdout and success', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'console.log(1 + 1)', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('2')
    })

    it('returns object under outputKey (step id by default)', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'return { x: 1 }', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ j1: { x: 1 } })
    })

    it('returns primitive under outputKey', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'return 42', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ j1: 42 })
    })

    it('uses custom outputKey when provided', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'return 42', outputKey: 'total', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ total: 42 })
    })

    it('sees params from context', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'return { seen: params.a }', dependsOn: [] }
      const result = await handler.run(step, { params: { a: '1' }, runSubFlow: noopRunSubFlow, stepResult })
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ j1: { seen: '1' } })
    })

    it('reports failure when code throws', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'throw new Error("expected")', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('expected')
    })

    it('awaits Promise and sets resolved value under outputKey', async () => {
      const step: FlowStep = {
        id: 'j1',
        type: 'js',
        run: 'return (async () => ({ ok: true }))()',
        dependsOn: [],
      }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ j1: { ok: true } })
    })

    it('returns success false with error on Promise reject', async () => {
      const step: FlowStep = {
        id: 'j1',
        type: 'js',
        run: 'return Promise.reject(new Error("async fail"))',
        dependsOn: [],
      }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toContain('async fail')
    })

    it('no return yields undefined under outputKey', async () => {
      const step: FlowStep = { id: 'j2', type: 'js', run: 'console.log("no return")', dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ j2: undefined })
    })

    it('loads and runs file when flowFilePath is set', async () => {
      const flowFilePath = path.join(__dirname, '..', 'fixtures', 'flow.yaml')
      const step: FlowStep = { id: 'j1', type: 'js', run: '', file: 'step.js', dependsOn: [] }
      const result = await handler.run(step, { params: {}, flowFilePath, runSubFlow: noopRunSubFlow, stepResult })
      expect(result.success).toBe(true)
      expect(result.outputs).toEqual({ j1: { fromFile: true } })
    })

    it('fails when file is used but flowFilePath is missing', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: '', file: 'step.js', dependsOn: [] }
      const result = await handler.run(step, { params: {}, runSubFlow: noopRunSubFlow, stepResult })
      expect(result.success).toBe(false)
      expect(result.error).toContain('flowFilePath')
    })

    it('fails when code exceeds handler timeout (step.timeout in ms)', async () => {
      const step: FlowStep = { id: 'j1', type: 'js', run: 'while(true){}', timeout: 100, dependsOn: [] }
      const result = await handler.run(step, emptyContext)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/timeout|timed out/i)
    })
  })
})
