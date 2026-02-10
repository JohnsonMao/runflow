import { describe, expect, it } from 'vitest'
import { parse } from './parser'

describe('parse', () => {
  it('returns null for empty string', () => {
    expect(parse('')).toBeNull()
  })

  it('returns null for invalid YAML', () => {
    expect(parse('not: valid: yaml:')).toBeNull()
  })

  it('returns null when name is missing', () => {
    const yaml = `
steps:
  - id: s1
    type: set
    set: {}
`
    expect(parse(yaml)).toBeNull()
  })

  it('returns null when steps is not an array', () => {
    const yaml = `
name: my-flow
steps: not-an-array
`
    expect(parse(yaml)).toBeNull()
  })

  it('parses step with unknown type as generic step', () => {
    const yaml = `
name: my-flow
steps:
  - id: s1
    type: unknown
    run: echo hi
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 's1', type: 'unknown', run: 'echo hi' })
  })

  it('parses minimal valid flow', () => {
    const yaml = `
name: my-flow
steps:
  - id: step1
    type: set
    set: { x: 1 }
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('my-flow')
    expect(flow?.steps).toHaveLength(1)
    expect(flow?.steps[0]).toEqual({ id: 'step1', type: 'set', set: { x: 1 } })
  })

  it('parses flow with description and multiple steps', () => {
    const yaml = `
name: my-flow
description: optional
steps:
  - id: step1
    type: set
    set: { a: 1 }
  - id: step2
    type: set
    set: { b: 2 }
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('my-flow')
    expect(flow?.description).toBe('optional')
    expect(flow?.steps).toHaveLength(2)
    expect(flow?.steps[1]).toMatchObject({ type: 'set', set: { b: 2 } })
  })

  it('parses set step without set (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: s1
    type: set
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 's1', type: 'set' })
  })

  it('parses set step with set object', () => {
    const yaml = `
name: my-flow
steps:
  - id: s1
    type: set
    set: { a: 1, b: 2 }
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps).toHaveLength(1)
    expect(flow?.steps[0]).toEqual({ id: 's1', type: 'set', set: { a: 1, b: 2 } })
  })

  it('parses flow with top-level params array', () => {
    const yaml = `
name: param-flow
params:
  - name: who
    type: string
    required: true
  - name: count
    type: number
    default: 1
steps:
  - id: s1
    type: set
    set: {}
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.params).toHaveLength(2)
    expect(flow?.params?.[0]).toMatchObject({ name: 'who', type: 'string', required: true })
    expect(flow?.params?.[1]).toMatchObject({ name: 'count', type: 'number', default: 1 })
  })

  it('parses http step with required url', () => {
    const yaml = `
name: my-flow
steps:
  - id: fetch
    type: http
    url: https://api.example.com/users
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toEqual({ id: 'fetch', type: 'http', url: 'https://api.example.com/users' })
  })

  it('parses http step with optional method, headers, body, output-key', () => {
    const yaml = `
name: my-flow
steps:
  - id: post
    type: http
    url: https://api.example.com/post
    method: POST
    headers:
      Content-Type: application/json
      Authorization: Bearer token
    body: '{"x":1}'
    output-key: apiResult
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({
      id: 'post',
      type: 'http',
      url: 'https://api.example.com/post',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
      body: '{"x":1}',
      outputKey: 'apiResult',
    })
  })

  it('parses http step without url (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: fetch
    type: http
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'fetch', type: 'http' })
  })

  it('parses http step with url as number (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: fetch
    type: http
    url: 123
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'fetch', type: 'http', url: 123 })
  })

  it('parses http step with non-string header value (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: fetch
    type: http
    url: https://example.com
    headers:
      X-Foo: 42
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'fetch', type: 'http', url: 'https://example.com', headers: { 'X-Foo': 42 } })
  })

  it('converts kebab-case keys to camelCase (depends-on, output-key)', () => {
    const yaml = `
name: kebab-flow
steps:
  - id: fetch
    type: http
    url: https://example.com
    output-key: apiResult
    depends-on: []
  - id: use
    type: set
    set: { done: true }
    depends-on: [fetch]
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('kebab-flow')
    expect(flow?.steps[0]).toMatchObject({
      id: 'fetch',
      type: 'http',
      url: 'https://example.com',
      outputKey: 'apiResult',
      dependsOn: [],
    })
    expect(flow?.steps[1]).toMatchObject({
      id: 'use',
      type: 'set',
      set: { done: true },
      dependsOn: ['fetch'],
    })
  })
})
