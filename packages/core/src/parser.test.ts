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
    const yaml = [
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
    ].join('\n')
    expect(parse(yaml)).toBeNull()
  })

  it('returns null when steps is not an array', () => {
    const yaml = [
      'name: my-flow',
      'steps: not-an-array',
    ].join('\n')
    expect(parse(yaml)).toBeNull()
  })

  it('parses step with unknown type as generic step', () => {
    const yaml = [
      'name: my-flow',
      'steps:',
      '  - id: s1',
      '    type: unknown',
      '    run: echo hi',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 's1', type: 'unknown', run: 'echo hi' })
  })

  it('preserves step name and description for flow-viewer labels', () => {
    const yaml = [
      'name: demo',
      'steps:',
      '  - id: init',
      '    name: 初始化',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
      '  - id: cond',
      '    name: 分支條件',
      '    type: condition',
      '    when: "true"',
      '    then: [a]',
      '    else: [b]',
      '    dependsOn: [init]',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0].name).toBe('初始化')
    expect(flow?.steps[1].name).toBe('分支條件')
  })

  it('parses minimal valid flow', () => {
    const yaml = [
      'name: my-flow',
      'steps:',
      '  - id: step1',
      '    type: set',
      '    set: { x: 1 }',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('my-flow')
    expect(flow?.steps).toHaveLength(1)
    expect(flow?.steps[0]).toEqual({ id: 'step1', type: 'set', set: { x: 1 } })
  })

  it('parses flow with description and multiple steps', () => {
    const yaml = [
      'name: my-flow',
      'description: optional',
      'steps:',
      '  - id: step1',
      '    type: set',
      '    set: { a: 1 }',
      '  - id: step2',
      '    type: set',
      '    set: { b: 2 }',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe('my-flow')
    expect(flow?.description).toBe('optional')
    expect(flow?.steps).toHaveLength(2)
    expect(flow?.steps[1]).toMatchObject({ type: 'set', set: { b: 2 } })
  })

  it('parses set step without set (generic step)', () => {
    const yaml = [
      'name: my-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps[0]).toMatchObject({ id: 's1', type: 'set' })
  })

  it('parses set step with set object', () => {
    const yaml = [
      'name: my-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { a: 1, b: 2 }',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.steps).toHaveLength(1)
    expect(flow?.steps[0]).toEqual({ id: 's1', type: 'set', set: { a: 1, b: 2 } })
  })

  it('parses flow with top-level params array', () => {
    const yaml = [
      'name: param-flow',
      'params:',
      '  - name: who',
      '    type: string',
      '    required: true',
      '  - name: count',
      '    type: number',
      '    default: 1',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.params).toHaveLength(2)
    expect(flow?.params?.[0]).toMatchObject({ name: 'who', type: 'string', required: true })
    expect(flow?.params?.[1]).toMatchObject({ name: 'count', type: 'number', default: 1 })
  })

  it('parses params with nested object schema', () => {
    const yaml = [
      'name: obj-params',
      'params:',
      '  - name: config',
      '    type: object',
      '    schema:',
      '      host: { type: string }',
      '      port: { type: number }',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.params).toHaveLength(1)
    expect(flow?.params?.[0]).toMatchObject({ name: 'config', type: 'object' })
    expect(flow?.params?.[0]?.schema).toMatchObject({
      host: { type: 'string' },
      port: { type: 'number' },
    })
  })

  it('parses params with nested array items', () => {
    const yaml = [
      'name: arr-params',
      'params:',
      '  - name: ids',
      '    type: array',
      '    items: { type: number }',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.params).toHaveLength(1)
    expect(flow?.params?.[0]).toMatchObject({ name: 'ids', type: 'array' })
    expect(flow?.params?.[0]?.items).toMatchObject({ type: 'number' })
  })

  it('parses params with object nested array nested object', () => {
    const yaml = [
      'name: nested-params',
      'params:',
      '  - name: data',
      '    type: object',
      '    schema:',
      '      rows:',
      '        type: array',
      '        items:',
      '          type: object',
      '          schema:',
      '            key: { type: string }',
      '            value: { type: number }',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
    ].join('\n')
    const flow = parse(yaml)
    expect(flow).not.toBeNull()
    expect(flow?.params).toHaveLength(1)
    expect(flow?.params?.[0]).toMatchObject({ name: 'data', type: 'object' })
    const schema = flow?.params?.[0]?.schema as Record<string, unknown>
    expect(schema?.rows).toMatchObject({ type: 'array' })
    const rowsItems = (schema?.rows as { items?: unknown })?.items as Record<string, unknown>
    expect(rowsItems).toMatchObject({ type: 'object' })
    expect(rowsItems?.schema).toMatchObject({
      key: { type: 'string' },
      value: { type: 'number' },
    })
  })
})
