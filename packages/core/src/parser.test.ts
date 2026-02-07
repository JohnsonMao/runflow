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

  it('returns null when step has invalid type', () => {
    const yaml = `
name: my-flow
steps:
  - id: s1
    type: unknown
    run: echo hi
`
    expect(parse(yaml)).toBeNull()
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
    expect(flow?.steps[1].run).toBe('node -e "console.log(1+1)"')
  })

  it('returns null when command step missing run', () => {
    const yaml = `
name: my-flow
steps:
  - id: s1
    type: command
`
    expect(parse(yaml)).toBeNull()
  })
})
