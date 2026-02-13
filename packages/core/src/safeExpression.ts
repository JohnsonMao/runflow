/**
 * Safe expression evaluator for condition/skip steps.
 * Only allows: params.x.y, literals (string, number, boolean, null), comparison and logical operators.
 * No function calls, no constructor/prototype access, no code execution.
 */

const FORBIDDEN_KEYS = new Set(['constructor', 'prototype', '__proto__'])

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key)
}

function getSafe(params: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = params
  for (const part of path) {
    if (isForbiddenKey(part))
      return undefined
    if (current === null || current === undefined)
      return undefined
    if (typeof current !== 'object')
      return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

type Token
  = | { type: 'id', value: string }
    | { type: 'num', value: number }
    | { type: 'str', value: string }
    | { type: 'op', value: string }
    | { type: 'true' }
    | { type: 'false' }
    | { type: 'null' }
    | { type: 'lp' }
    | { type: 'rp' }
    | { type: 'dot' }
    | { type: 'eof' }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = input.trim()
  while (i < s.length) {
    const rest = s.slice(i)
    if (/^\s+/.test(rest)) {
      i += rest.match(/^\s+/)![0].length
      continue
    }
    if (rest.startsWith('===')) {
      tokens.push({ type: 'op', value: '===' })
      i += 3
      continue
    }
    if (rest.startsWith('!==')) {
      tokens.push({ type: 'op', value: '!==' })
      i += 3
      continue
    }
    if (rest.startsWith('==') || rest.startsWith('!=') || rest.startsWith('<=') || rest.startsWith('>=')) {
      tokens.push({ type: 'op', value: rest.slice(0, 2) })
      i += 2
      continue
    }
    if ('()!.&|<>+-'.includes(rest[0]!)) {
      if (rest[0] === '.') {
        tokens.push({ type: 'dot' })
        i += 1
      }
      else if (rest[0] === '&' && rest[1] === '&') {
        tokens.push({ type: 'op', value: '&&' })
        i += 2
      }
      else if (rest[0] === '|' && rest[1] === '|') {
        tokens.push({ type: 'op', value: '||' })
        i += 2
      }
      else if (rest[0] === '+' || rest[0] === '-') {
        tokens.push({ type: 'op', value: rest[0]! })
        i += 1
      }
      else {
        const c = rest[0]!
        if (c === '(')
          tokens.push({ type: 'lp' })
        else if (c === ')')
          tokens.push({ type: 'rp' })
        else if (c === '.')
          tokens.push({ type: 'dot' })
        else if (c === '!' || c === '<' || c === '>')
          tokens.push({ type: 'op', value: c })
        i += 1
      }
      continue
    }
    if (rest.startsWith('true') && !/^true\w/.test(rest)) {
      tokens.push({ type: 'true' })
      i += 4
      continue
    }
    if (rest.startsWith('false') && !/^false\w/.test(rest)) {
      tokens.push({ type: 'false' })
      i += 5
      continue
    }
    if (rest.startsWith('null') && !/^null\w/.test(rest)) {
      tokens.push({ type: 'null' })
      i += 4
      continue
    }
    if (rest.startsWith('params') && !/^params\w/.test(rest)) {
      tokens.push({ type: 'id', value: 'params' })
      i += 6
      continue
    }
    const idMatch = rest.match(/^([a-z_]\w*)/i)
    if (idMatch) {
      tokens.push({ type: 'id', value: idMatch[1]! })
      i += idMatch[0]!.length
      continue
    }
    const numMatch = rest.match(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)
    if (numMatch) {
      tokens.push({ type: 'num', value: Number(numMatch[0]) })
      i += numMatch[0]!.length
      continue
    }
    if ((rest.startsWith('"') || rest.startsWith('\'')) && rest[0]) {
      const quote = rest[0] as '"' | '\''
      let j = 1
      while (j < rest.length && rest[j] !== quote) {
        if (rest[j] === '\\')
          j += 1
        j += 1
      }
      if (j >= rest.length)
        throw new Error('Unterminated string')
      const raw = rest.slice(1, j)
      const value = raw.replace(/\\(.)/g, (_, c: string) => {
        if (c === 'n')
          return '\n'
        if (c === 'r')
          return '\r'
        if (c === 't')
          return '\t'
        return c
      })
      tokens.push({ type: 'str', value })
      i += j + 1
      continue
    }
    throw new Error(`Unexpected character at position ${i}: ${rest[0]}`)
  }
  tokens.push({ type: 'eof' })
  return tokens
}

export class SafeExpressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafeExpressionError'
  }
}

export interface SafeExpressionOptions {
  /** Max expression length (default 2000). */
  maxLength?: number
}

/**
 * Evaluate a safe expression to a boolean. Use for condition/skip.
 * Allowed: params, params.x, params.x.y, literals, ==, !=, ===, !==, <, >, <=, >=, &&, ||, !, ().
 */
export function evaluateToBoolean(
  expression: string,
  params: Record<string, unknown>,
  options?: SafeExpressionOptions,
): boolean {
  const val = evaluate(expression, params, options)
  return Boolean(val)
}

/**
 * Evaluate a safe expression to a value.
 * Same grammar as evaluateToBoolean; returns the expression value (e.g. params.foo).
 */
export function evaluate(
  expression: string,
  params: Record<string, unknown>,
  options?: SafeExpressionOptions,
): unknown {
  const maxLen = options?.maxLength ?? 2000
  if (expression.length > maxLen)
    throw new SafeExpressionError(`Expression exceeds max length ${maxLen}`)
  const tokens = tokenize(expression)
  let pos = 0
  function cur(): Token {
    return tokens[pos] ?? { type: 'eof' }
  }
  function consume(t: Token['type'], value?: string): void {
    const c = cur()
    if (c.type !== t || (value != null && 'value' in c && c.value !== value))
      throw new SafeExpressionError(`Expected ${t}${value != null ? ` "${value}"` : ''}, got ${c.type}`)
    pos += 1
  }
  function parseExpr(): unknown {
    return parseLogicalOr()
  }
  function parseLogicalOr(): unknown {
    let left = parseLogicalAnd()
    while (cur().type === 'op' && (cur() as { value: string }).value === '||') {
      consume('op', '||')
      const right = parseLogicalAnd()
      left = Boolean(left) || Boolean(right)
    }
    return left
  }
  function parseLogicalAnd(): unknown {
    let left = parseEquality()
    while (cur().type === 'op' && (cur() as { value: string }).value === '&&') {
      consume('op', '&&')
      const right = parseEquality()
      left = Boolean(left) && Boolean(right)
    }
    return left
  }
  function parseEquality(): unknown {
    let left = parseComparison()
    while (cur().type === 'op') {
      const op = (cur() as { value: string }).value
      if (op !== '==' && op !== '!=' && op !== '===' && op !== '!==')
        break
      consume('op')
      const right = parseComparison()
      // Loose equality for == / != to match expression semantics (e.g. 1 == '1')
      if (op === '==')
        left = left == right // eslint-disable-line eqeqeq
      else if (op === '!=')
        left = left != right // eslint-disable-line eqeqeq
      else if (op === '===')
        left = left === right
      else
        left = left !== right
    }
    return left
  }
  function parseComparison(): unknown {
    let left = parseAdditive()
    while (cur().type === 'op') {
      const op = (cur() as { value: string }).value
      if (op !== '<' && op !== '>' && op !== '<=' && op !== '>=')
        break
      consume('op')
      let rightVal = parseAdditive()
      if (typeof left !== 'number' && typeof left !== 'string')
        left = Number(left)
      if (typeof rightVal !== 'number' && typeof rightVal !== 'string')
        rightVal = Number(rightVal)
      if (op === '<')
        left = (left as number) < (rightVal as number)
      else if (op === '>')
        left = (left as number) > (rightVal as number)
      else if (op === '<=')
        left = (left as number) <= (rightVal as number)
      else left = (left as number) >= (rightVal as number)
    }
    return left
  }
  function parseAdditive(): unknown {
    let left = parsePrimary()
    while (cur().type === 'op') {
      const op = (cur() as { value: string }).value
      if (op !== '+' && op !== '-')
        break
      consume('op')
      const right = parsePrimary()
      const l = Number(left)
      const r = Number(right)
      if (Number.isNaN(l) || Number.isNaN(r))
        throw new SafeExpressionError('Arithmetic requires numbers')
      left = op === '+' ? l + r : l - r
    }
    return left
  }
  function parsePrimary(): unknown {
    if (cur().type === 'lp') {
      consume('lp')
      const v = parseExpr()
      consume('rp')
      return v
    }
    if (cur().type === 'op' && (cur() as { value: string }).value === '!') {
      consume('op', '!')
      return !parsePrimary()
    }
    if (cur().type === 'op' && ((cur() as { value: string }).value === '-' || (cur() as { value: string }).value === '+')) {
      const isMinus = (cur() as { value: string }).value === '-'
      consume('op')
      const v = parsePrimary()
      const n = Number(v)
      if (Number.isNaN(n))
        throw new SafeExpressionError('Unary +/- requires a number')
      return isMinus ? -n : n
    }
    if (cur().type === 'true') {
      consume('true')
      return true
    }
    if (cur().type === 'false') {
      consume('false')
      return false
    }
    if (cur().type === 'null') {
      consume('null')
      return null
    }
    if (cur().type === 'num') {
      const v = (cur() as { value: number }).value
      consume('num')
      return v
    }
    if (cur().type === 'str') {
      const v = (cur() as { value: string }).value
      consume('str')
      return v
    }
    if (cur().type === 'id' && (cur() as { value: string }).value === 'params') {
      consume('id', 'params')
      const path: string[] = []
      while (cur().type === 'dot') {
        consume('dot')
        const t = cur()
        if (t.type !== 'id')
          throw new SafeExpressionError('Expected identifier after .')
        if (isForbiddenKey(t.value))
          throw new SafeExpressionError('Forbidden property access')
        path.push(t.value)
        consume('id')
      }
      return getSafe(params, path)
    }
    throw new SafeExpressionError(`Unexpected token: ${cur().type}`)
  }
  const result = parseExpr()
  if (cur().type !== 'eof')
    throw new SafeExpressionError('Unexpected token at end')
  return result
}
