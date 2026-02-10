import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
import { describe, expect, it } from 'vitest'
import { openApiToFlows } from './index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures')

const mockHttpHandler: IStepHandler = {
  validate: () => true,
  kill: () => {},
  run: async (step: FlowStep, context: StepContext): Promise<StepResult> => {
    return context.stepResult(step.id, true, {
      outputs: { [step.id]: { statusCode: 200, body: {} } },
    })
  },
}

describe('integration: openApiToFlows + run', () => {
  it('load OpenAPI file, get flow, run with run(flow, { params })', async () => {
    const result = await openApiToFlows(join(FIXTURES, 'minimal-openapi.yaml'), { output: 'memory' })
    const flow = result.get('get-users-id')
    expect(flow).toBeDefined()
    expect(flow!.steps.some(s => s.type === 'http')).toBe(true)

    const registry = createBuiltinRegistry()
    registry.http = mockHttpHandler

    const runResult = await run(flow!, {
      params: { id: '1' },
      registry,
    })
    expect(runResult.success).toBe(true)
    expect(runResult.steps.length).toBeGreaterThanOrEqual(1)
    expect(runResult.steps[0].success).toBe(true)
  })
})
