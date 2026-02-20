import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateRequest } from './validateRequest.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'fixtures')

describe('validateRequest', () => {
  it('returns valid when context has no openApiSpecPath or openApiOperationKey', async () => {
    const result = await validateRequest(
      { id: 'api', type: 'http', url: 'https://example.com', dependsOn: [] },
      {},
    )
    expect(result.valid).toBe(true)
  })

  it('returns valid when spec and operation exist and no required body', async () => {
    const result = await validateRequest(
      { id: 'api', type: 'http', url: 'https://example.com', method: 'get', dependsOn: [] },
      { openApiSpecPath: join(FIXTURES, 'minimal-openapi.yaml'), openApiOperationKey: 'get-users' },
    )
    expect(result.valid).toBe(true)
  })

  it('reads openApiSpecPath and openApiOperationKey from context.params', async () => {
    const result = await validateRequest(
      { id: 'api', type: 'http', url: 'https://example.com', method: 'get', dependsOn: [] },
      { params: { openApiSpecPath: join(FIXTURES, 'minimal-openapi.yaml'), openApiOperationKey: 'get-users' } },
    )
    expect(result.valid).toBe(true)
  })

  it('returns invalid when operation key not found', async () => {
    const result = await validateRequest(
      { id: 'api', type: 'http', url: 'https://example.com', dependsOn: [] },
      { openApiSpecPath: join(FIXTURES, 'minimal-openapi.yaml'), openApiOperationKey: 'post-other' },
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Operation not found')
  })

  it('returns invalid when spec path fails to load', async () => {
    const result = await validateRequest(
      { id: 'api', type: 'http', url: 'https://example.com', dependsOn: [] },
      { openApiSpecPath: '/nonexistent/spec.yaml', openApiOperationKey: 'get-users' },
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })
})
