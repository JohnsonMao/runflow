import type { ParamDeclaration } from '@runflow/core'
import type { CollectedOperation } from './collectOperations.js'
import type { OpenApiDocument } from './types.js'
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

  it('resolves requestBody $ref to object schema when doc has components.schemas', () => {
    const doc: OpenApiDocument = {
      components: {
        schemas: {
          PayByTxnTokenRequestEntity: {
            type: 'object',
            required: ['txnToken', 'merchantConsumerId'],
            properties: {
              txnToken: { type: 'string', description: 'SDK 取得的 txnToken' },
              merchantConsumerId: { type: 'string', description: '商店會員編號' },
            },
          },
        },
      },
    }
    const op: CollectedOperation = {
      key: 'post-v2-payments-request-by-txnToken',
      path: '/v2/payments/request-by-txnToken',
      method: 'post',
      pathItem: {},
      operation: {
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PayByTxnTokenRequestEntity' },
            },
          },
        },
      } as Record<string, unknown>,
    }
    const paramsWithoutDoc = mapParamsToDeclarations(op)
    const bodyWithoutDoc = paramsWithoutDoc.find((p: ParamDeclaration) => p.name === 'body')
    expect(bodyWithoutDoc!.type).toBe('string')

    const paramsWithDoc = mapParamsToDeclarations(op, doc)
    const bodyWithDoc = paramsWithDoc.find((p: ParamDeclaration) => p.name === 'body')
    expect(bodyWithDoc).toBeDefined()
    expect(bodyWithDoc!.type).toBe('object')
    expect(bodyWithDoc!.schema).toBeDefined()
    expect(Object.keys(bodyWithDoc!.schema!)).toContain('txnToken')
    expect(Object.keys(bodyWithDoc!.schema!)).toContain('merchantConsumerId')
  })

  it('resolves requestBody allOf to merged object schema when doc provided', () => {
    const doc: OpenApiDocument = {
      components: {
        schemas: {
          Base: {
            type: 'object',
            required: ['payType'],
            properties: { payType: { type: 'string' } },
          },
        },
      },
    }
    const op: CollectedOperation = {
      key: 'post-pay',
      path: '/pay',
      method: 'post',
      pathItem: {},
      operation: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { type: 'object', required: ['txnToken'], properties: { txnToken: { type: 'string' } } },
                  { $ref: '#/components/schemas/Base' },
                ],
              },
            },
          },
        },
      } as Record<string, unknown>,
    }
    const params = mapParamsToDeclarations(op, doc)
    const body = params.find((p: ParamDeclaration) => p.name === 'body')
    expect(body).toBeDefined()
    expect(body!.type).toBe('object')
    expect(body!.schema).toBeDefined()
    expect(Object.keys(body!.schema!)).toContain('txnToken')
    expect(Object.keys(body!.schema!)).toContain('payType')
  })
})
