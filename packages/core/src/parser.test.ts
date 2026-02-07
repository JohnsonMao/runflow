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
    type: command
    run: echo hi
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
    type: command
    run: echo "hello"
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('my-flow')
    expect(flow?.steps).toHaveLength(1)
    expect(flow?.steps[0]).toEqual({ id: 'step1', type: 'command', run: 'echo "hello"' })
  })

  it('parses flow with description and multiple steps', () => {
    const yaml = `
name: my-flow
description: optional
steps:
  - id: step1
    type: command
    run: echo "hello"
  - id: step2
    type: command
    run: node -e "console.log(1+1)"
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('my-flow')
    expect(flow?.description).toBe('optional')
    expect(flow?.steps).toHaveLength(2)
    expect(flow?.steps[1]).toMatchObject({ type: 'command', run: 'node -e "console.log(1+1)"' })
  })

  it('parses command step without run (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: s1
    type: command
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 's1', type: 'command' })
  })

  it('parses js step with run string', () => {
    const yaml = `
name: my-flow
steps:
  - id: js1
    type: js
    run: return 1 + 1
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps).toHaveLength(1)
    expect(flow?.steps[0]).toEqual({ id: 'js1', type: 'js', run: 'return 1 + 1' })
  })

  it('parses js step without run (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: js1
    type: js
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'js1', type: 'js' })
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
    type: command
    run: echo hi
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.params).toHaveLength(2)
    expect(flow?.params?.[0]).toMatchObject({ name: 'who', type: 'string', required: true })
    expect(flow?.params?.[1]).toMatchObject({ name: 'count', type: 'number', default: 1 })
  })

  it('parses js step with file', () => {
    const yaml = `
name: my-flow
steps:
  - id: js1
    type: js
    file: ./scripts/step.js
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'js1', type: 'js', file: './scripts/step.js' })
  })

  it('parses js step with file ending in .ts (generic step)', () => {
    const yaml = `
name: my-flow
steps:
  - id: js1
    type: js
    file: ./script.ts
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'js1', type: 'js', file: './script.ts' })
  })

  it('parses js step with both file and run (file wins)', () => {
    const yaml = `
name: my-flow
steps:
  - id: js1
    type: js
    file: ./step.js
    run: return 1
`
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 'js1', type: 'js', file: './step.js' })
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

  it('parses http step with optional method, headers, body, output, allowErrorStatus', () => {
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
    output: apiResult
    allowErrorStatus: true
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
      output: 'apiResult',
      allowErrorStatus: true,
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
})
