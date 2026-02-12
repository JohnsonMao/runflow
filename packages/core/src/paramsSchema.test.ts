import type { ParamDeclaration } from './types'
import { describe, expect, it } from 'vitest'
import { isParamType, paramsDeclarationToZodSchema } from './paramsSchema'

describe('paramsDeclarationToZodSchema', () => {
  it('returns permissive record when declarations is empty', () => {
    const schema = paramsDeclarationToZodSchema([])
    expect(schema.safeParse({})).toMatchObject({ success: true })
    expect(schema.safeParse({ any: 'key' })).toMatchObject({ success: true })
  })

  it('validates string param', () => {
    const decl: ParamDeclaration[] = [{ name: 'x', type: 'string' }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ x: 'hello' })).toMatchObject({ success: true })
    expect(schema.safeParse({ x: 1 }).success).toBe(false)
  })

  it('required string param rejects missing key', () => {
    const decl: ParamDeclaration[] = [{ name: 'x', type: 'string', required: true }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ x: 'ok' })).toMatchObject({ success: true })
  })

  it('validates number param', () => {
    const decl: ParamDeclaration[] = [{ name: 'n', type: 'number' }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ n: 42 })).toMatchObject({ success: true })
    expect(schema.safeParse({ n: '42' }).success).toBe(false)
  })

  it('validates boolean param', () => {
    const decl: ParamDeclaration[] = [{ name: 'flag', type: 'boolean' }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ flag: true })).toMatchObject({ success: true })
    expect(schema.safeParse({ flag: false })).toMatchObject({ success: true })
    expect(schema.safeParse({ flag: 1 }).success).toBe(false)
  })

  it('unknown param type uses permissive schema', () => {
    const decl = [{ name: 'x', type: 'other' }] as unknown as ParamDeclaration[]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ x: 'any' })).toMatchObject({ success: true })
    expect(schema.safeParse({ x: 123 })).toMatchObject({ success: true })
  })

  it('optional param when required is false', () => {
    const decl: ParamDeclaration[] = [{ name: 'opt', type: 'string', required: false }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({})).toMatchObject({ success: true })
    expect(schema.safeParse({ opt: 'x' })).toMatchObject({ success: true })
  })

  it('default value when default is set', () => {
    const decl: ParamDeclaration[] = [{ name: 'd', type: 'string', default: 'default' }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({}).success).toBe(true)
    expect(schema.safeParse({ d: 'custom' })).toMatchObject({ success: true, data: { d: 'custom' } })
  })

  it('enum: single value', () => {
    const decl: ParamDeclaration[] = [{ name: 'e', type: 'string', enum: ['a'] }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ e: 'a' })).toMatchObject({ success: true })
    expect(schema.safeParse({ e: 'b' }).success).toBe(false)
  })

  it('enum: multiple values', () => {
    const decl: ParamDeclaration[] = [{ name: 'e', type: 'string', enum: ['a', 'b', 'c'] }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ e: 'a' })).toMatchObject({ success: true })
    expect(schema.safeParse({ e: 'b' })).toMatchObject({ success: true })
    expect(schema.safeParse({ e: 'd' }).success).toBe(false)
  })

  it('object with schema', () => {
    const decl: ParamDeclaration[] = [
      {
        name: 'obj',
        type: 'object',
        schema: { inner: { type: 'string' } },
      },
    ]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ obj: { inner: 'x' } })).toMatchObject({ success: true })
    expect(schema.safeParse({ obj: { inner: 1 } }).success).toBe(false)
  })

  it('object without schema uses record', () => {
    const decl: ParamDeclaration[] = [{ name: 'obj', type: 'object' }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ obj: { a: 1, b: 'x' } })).toMatchObject({ success: true })
  })

  it('array with items', () => {
    const decl: ParamDeclaration[] = [
      { name: 'arr', type: 'array', items: { type: 'number' } },
    ]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ arr: [1, 2, 3] })).toMatchObject({ success: true })
    expect(schema.safeParse({ arr: [1, 'x'] }).success).toBe(false)
  })

  it('array without items accepts unknown array', () => {
    const decl: ParamDeclaration[] = [{ name: 'arr', type: 'array' }]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ arr: [1, 'x', {}] })).toMatchObject({ success: true })
  })

  it('object with schema containing array (object nested array)', () => {
    const decl: ParamDeclaration[] = [
      {
        name: 'obj',
        type: 'object',
        schema: {
          list: { type: 'array', items: { type: 'number' } },
        },
      },
    ]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ obj: { list: [1, 2, 3] } })).toMatchObject({ success: true })
    expect(schema.safeParse({ obj: { list: [1, 'x'] } }).success).toBe(false)
  })

  it('array with items of type object (array nested object)', () => {
    const decl: ParamDeclaration[] = [
      {
        name: 'rows',
        type: 'array',
        items: {
          type: 'object',
          schema: { id: { type: 'number' }, label: { type: 'string' } },
        },
      },
    ]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ rows: [{ id: 1, label: 'a' }, { id: 2, label: 'b' }] })).toMatchObject({ success: true })
    expect(schema.safeParse({ rows: [{ id: 1, label: 'a' }, { id: 'invalid', label: 'b' }] }).success).toBe(false)
  })

  it('object with schema containing array of objects (object nested array nested object)', () => {
    const decl: ParamDeclaration[] = [
      {
        name: 'data',
        type: 'object',
        schema: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              schema: { key: { type: 'string' }, value: { type: 'number' } },
            },
          },
        },
      },
    ]
    const schema = paramsDeclarationToZodSchema(decl)
    expect(schema.safeParse({ data: { items: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }] } })).toMatchObject({ success: true })
    expect(schema.safeParse({ data: { items: [{ key: 'a', value: 'not-number' }] } }).success).toBe(false)
  })

  it('allows extra keys (passthrough) for global config params', () => {
    const decl: ParamDeclaration[] = [{ name: 'x', type: 'string' }]
    const schema = paramsDeclarationToZodSchema(decl)
    const parsed = schema.safeParse({ x: 'ok', extra: 1 })
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toMatchObject({ x: 'ok', extra: 1 })
  })
})

describe('isParamType', () => {
  it('returns true for valid param types', () => {
    expect(isParamType('string')).toBe(true)
    expect(isParamType('number')).toBe(true)
    expect(isParamType('boolean')).toBe(true)
    expect(isParamType('object')).toBe(true)
    expect(isParamType('array')).toBe(true)
  })

  it('returns false for invalid string', () => {
    expect(isParamType('other')).toBe(false)
    expect(isParamType('')).toBe(false)
  })

  it('returns false for non-string', () => {
    expect(isParamType(1)).toBe(false)
    expect(isParamType(null)).toBe(false)
    expect(isParamType(undefined)).toBe(false)
    expect(isParamType([])).toBe(false)
  })
})
