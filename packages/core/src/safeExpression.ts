/**
 * Safe expression evaluator for condition/skip steps.
 * Only allows: params.x.y, literals (string, number, boolean, null), comparison and logical operators.
 * No function calls (except whitelisted array methods), no constructor/prototype access, no code execution.
 */

import { isPlainObject } from './utils'

const FORBIDDEN_KEYS = new Set(['constructor', 'prototype', '__proto__'])

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key)
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
    | { type: 'lb' }
    | { type: 'rb' }
    | { type: 'dot' }
    | { type: 'comma' }
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
    if ('()[]!,!.&|<>+-'.includes(rest[0]!)) {
      if (rest[0] === '.') {
        tokens.push({ type: 'dot' })
        i += 1
      }
      else if (rest[0] === '[') {
        tokens.push({ type: 'lb' })
        i += 1
      }
      else if (rest[0] === ']') {
        tokens.push({ type: 'rb' })
        i += 1
      }
      else if (rest[0] === ',') {
        tokens.push({ type: 'comma' })
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

/** Internal parser state/context to support nested evaluation (map/filter). */
class ExpressionParser {
  pos = 0
  constructor(
    private tokens: Token[],
    private params: Record<string, unknown>,
  ) {}

  cur(): Token {
    return this.tokens[this.pos] ?? { type: 'eof' }
  }

  consume(t: Token['type'], value?: string): void {
    const c = this.cur()
    if (c.type !== t || (value != null && 'value' in c && c.value !== value))
      throw new SafeExpressionError(`Expected ${t}${value != null ? ` "${value}"` : ''}, got ${c.type}`)
    this.pos += 1
  }

  parseExpr(): unknown {
    return this.parseLogicalOr()
  }

  parseLogicalOr(): unknown {
    let left = this.parseLogicalAnd()
    while (this.cur().type === 'op' && (this.cur() as { value: string }).value === '||') {
      this.consume('op', '||')
      const right = this.parseLogicalAnd()
      left = Boolean(left) || Boolean(right)
    }
    return left
  }

  parseLogicalAnd(): unknown {
    let left = this.parseEquality()
    while (this.cur().type === 'op' && (this.cur() as { value: string }).value === '&&') {
      this.consume('op', '&&')
      const right = this.parseEquality()
      left = Boolean(left) && Boolean(right)
    }
    return left
  }

  parseEquality(): unknown {
    let left = this.parseComparison()
    while (this.cur().type === 'op') {
      const op = (this.cur() as { value: string }).value
      if (op !== '==' && op !== '!=' && op !== '===' && op !== '!==')
        break
      this.consume('op')
      const right = this.parseComparison()
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

  parseComparison(): unknown {
    let left = this.parseAdditive()
    while (this.cur().type === 'op') {
      const op = (this.cur() as { value: string }).value
      if (op !== '<' && op !== '>' && op !== '<=' && op !== '>=')
        break
      this.consume('op')
      let rightVal = this.parseAdditive()
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

  parseAdditive(): unknown {
    let left = this.parsePrimary()
    while (this.cur().type === 'op') {
      const op = (this.cur() as { value: string }).value
      if (op !== '+' && op !== '-')
        break
      this.consume('op')
      const right = this.parsePrimary()
      if (op === '+') {
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right)
        }
        else {
          const l = Number(left)
          const r = Number(right)
          if (Number.isNaN(l) || Number.isNaN(r))
            throw new SafeExpressionError('Arithmetic requires numbers')
          left = l + r
        }
      }
      else {
        const l = Number(left)
        const r = Number(right)
        if (Number.isNaN(l) || Number.isNaN(r))
          throw new SafeExpressionError('Arithmetic requires numbers')
        left = l - r
      }
    }
    return left
  }

  parsePrimary(): unknown {
    let val: unknown
    if (this.cur().type === 'lp') {
      this.consume('lp')
      val = this.parseExpr()
      this.consume('rp')
    }
    else if (this.cur().type === 'op' && (this.cur() as { value: string }).value === '!') {
      this.consume('op', '!')
      val = !this.parsePrimary()
    }
    else if (this.cur().type === 'op' && ((this.cur() as { value: string }).value === '-' || (this.cur() as { value: string }).value === '+')) {
      const isMinus = (this.cur() as { value: string }).value === '-'
      this.consume('op')
      const v = this.parsePrimary()
      const n = Number(v)
      if (Number.isNaN(n))
        throw new SafeExpressionError('Unary +/- requires a number')
      val = isMinus ? -n : n
    }
    else if (this.cur().type === 'true') {
      this.consume('true')
      val = true
    }
    else if (this.cur().type === 'false') {
      this.consume('false')
      val = false
    }
    else if (this.cur().type === 'null') {
      this.consume('null')
      val = null
    }
    else if (this.cur().type === 'num') {
      val = (this.cur() as { value: number }).value
      this.consume('num')
    }
    else if (this.cur().type === 'str') {
      val = (this.cur() as { value: string }).value
      this.consume('str')
    }
    else if (this.cur().type === 'id') {
      const name = (this.cur() as { value: string }).value
      this.consume('id')
      if (name === 'params') {
        val = this.params
      }
      else {
        // Handle identifier as property access on current context (for filter/map items)
        val = this.params[name]
      }
    }
    else {
      throw new SafeExpressionError(`Unexpected token: ${this.cur().type}`)
    }

    // Member access chain: .prop, .method(), [index]
    while (true) {
      if (this.cur().type === 'dot') {
        this.consume('dot')
        const t = this.cur()
        if (t.type !== 'id')
          throw new SafeExpressionError('Expected identifier after .')
        const member = t.value
        if (isForbiddenKey(member))
          throw new SafeExpressionError('Forbidden property access')
        this.consume('id')

        if (this.cur().type === 'lp') {
          // Method call
          this.consume('lp')
          if (member === 'map') {
            const argT = this.cur()
            let prop: string | undefined
            if (argT.type === 'id') {
              prop = argT.value
              this.consume('id')
            }
            this.consume('rp')
            if (Array.isArray(val) && prop)
              val = val.map(item => (isPlainObject(item) ? item[prop!] : undefined))
            else
              val = []
          }
          else if (member === 'filter') {
            const start = this.pos
            let depth = 1
            while (depth > 0 && this.cur().type !== 'eof') {
              if (this.cur().type === 'lp')
                depth++
              else if (this.cur().type === 'rp')
                depth--
              if (depth > 0)
                this.pos++
            }
            const predicateTokens = this.tokens.slice(start, this.pos)
            this.consume('rp')
            if (Array.isArray(val)) {
              val = val.filter((item) => {
                const itemCtx = isPlainObject(item) ? { ...this.params, ...item, val: item } : { ...this.params, val: item }
                const parser = new ExpressionParser(predicateTokens, itemCtx)
                return Boolean(parser.parseExpr())
              })
            }
            else {
              val = []
            }
          }
          else if (member === 'slice') {
            const s = Number(this.parseExpr())
            let e: number | undefined
            if (this.cur().type === 'comma') {
              this.consume('comma')
              e = Number(this.parseExpr())
            }
            this.consume('rp')
            if (Array.isArray(val))
              val = val.slice(s, e)
            else
              val = []
          }
          else {
            throw new SafeExpressionError(`Unknown method: ${member}`)
          }
        }
        else {
          if (val != null && typeof val === 'object')
            val = (val as Record<string, unknown>)[member]
          else
            val = undefined
        }
      }
      else if (this.cur().type === 'lb') {
        this.consume('lb')
        const idx = this.parseExpr()
        this.consume('rb')
        if (Array.isArray(val))
          val = val[Number(idx)]
        else if (val != null && typeof val === 'object')
          val = (val as Record<string, unknown>)[String(idx)]
        else
          val = undefined
      }
      else {
        break
      }
    }
    return val
  }
}

/**
 * Evaluate a safe expression to a boolean. Use for condition/skip.
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
  const parser = new ExpressionParser(tokens, params)
  const result = parser.parseExpr()
  if (parser.cur().type !== 'eof')
    throw new SafeExpressionError('Unexpected token at end')
  return result
}
