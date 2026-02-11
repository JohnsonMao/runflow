import type { ParamDeclaration } from '@runflow/core'
import type { CollectedOperation } from './collectOperations.js'
import { describe, expect, it } from 'vitest'
import { mapParamsToDeclarations } from './mapParams.js'

describe('mapParamsToDeclarations', () => {
  it('maps query param with integer schema to number type', () => {
    const op: CollectedOperation = {
      key: 'get-users',
      path: '/users',
      method: 'get',
      pathItem: {},
      operation: {
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
        ],
      } as Record<string, unknown>,
    }
    const params = mapParamsToDeclarations(op)
    expect(params).toHaveLength(1)
    expect(params[0].name).toBe('limit')
    expect(params[0].type).toBe('number')
  })

  it('maps requestBody application/json to body param with object schema', () => {
    const op: CollectedOperation = {
      key: 'post-users',
      path: '/users',
      method: 'post',
      pathItem: {},
      operation: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'integer' },
                },
                required: ['name'],
              },
            },
          },
        },
      } as Record<string, unknown>,
    }
    const params = mapParamsToDeclarations(op)
    const bodyParam = params.find((p: ParamDeclaration) => p.name === 'body')
    expect(bodyParam).toBeDefined()
    expect(bodyParam!.type).toBe('object')
    expect(bodyParam!.schema).toBeDefined()
    expect(Object.keys(bodyParam!.schema!)).toContain('name')
    expect(Object.keys(bodyParam!.schema!)).toContain('age')
  })

  it('deduplicates params by name (pathItem and operation)', () => {
    const op: CollectedOperation = {
      key: 'get-users-id',
      path: '/users/{id}',
      method: 'get',
      pathItem: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      } as Record<string, unknown>,
      operation: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      } as Record<string, unknown>,
    }
    const params = mapParamsToDeclarations(op)
    expect(params.filter((p: ParamDeclaration) => p.name === 'id')).toHaveLength(1)
  })

  it('uses description from parameter when present', () => {
    const op: CollectedOperation = {
      key: 'get-x',
      path: '/x',
      method: 'get',
      pathItem: {},
      operation: {
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Search query',
            schema: { type: 'string' },
          },
        ],
      } as Record<string, unknown>,
    }
    const params = mapParamsToDeclarations(op)
    expect(params[0].description).toBe('Search query')
  })
})
