import type { FlowDefinition } from '@runflow/core'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

/**
 * Load a flow from a file path (YAML or JSON). Used by workspace after core no longer provides loadFromFile.
 * @returns FlowDefinition or null if file is unreadable or content is invalid.
 */
export function loadFromFile(filePath: string): FlowDefinition | null {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const ext = path.extname(filePath).toLowerCase()
    const data = ext === '.json' ? JSON.parse(raw) as unknown : (parseYaml(raw) as unknown)
    if (!data || typeof data !== 'object' || !Array.isArray((data as FlowDefinition).steps))
      return null
    return data as FlowDefinition
  }
  catch {
    return null
  }
}
