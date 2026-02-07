import type { FlowDefinition } from './types'
// @env node
import { readFileSync } from 'node:fs'
import { parse } from './parser'

export function loadFromFile(filePath: string): FlowDefinition | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return parse(content)
  }
  catch {
    return null
  }
}
