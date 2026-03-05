import type { HandlerConfig } from '@runflow/core'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRegistry, createFactoryContext, run } from '@runflow/core'
import { builtinHandlers } from '@runflow/handlers'
import { describe, expect, it } from 'vitest'
import { openApiToFlows } from './index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures')

const mockHttpHandler: HandlerConfig = {
  type: 'http',
  run: async (ctx) => {
    ctx.report({
      success: true,
      outputs: { [ctx.step.id]: { statusCode: 200, body: {} } },
    })
  },
}

describe('integration: openApiToFlows + run', () => {
  it('load OpenAPI file, get flow, run with run(flow, { params })', async () => {
    const result = await openApiToFlows(join(FIXTURES, 'minimal-openapi.yaml'), { output: 'memory', stepType: 'http' })
    const flow = result.get('get-users-id')
    expect(flow).toBeDefined()
    expect(flow!.steps.some(s => s.type === 'http')).toBe(true)

    const factoryContext = createFactoryContext()
    const handlers = [
      ...builtinHandlers.map(f => f(factoryContext)).filter(h => h.type !== 'http'),
      mockHttpHandler,
    ]
    const registry = buildRegistry(handlers)

    const runResult = await run(flow!, {
      params: { id: '1' },
      registry,
    })
    expect(runResult.success).toBe(true)
    expect(runResult.steps.length).toBeGreaterThanOrEqual(1)
    expect(runResult.steps[0].success).toBe(true)
  })
})
