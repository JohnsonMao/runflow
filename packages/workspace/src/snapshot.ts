import type { RunResult } from '@runflow/core'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Save execution result to .runflow/runs/latest.json
 */
export function saveRunResult(result: RunResult, cwd: string = process.cwd()): void {
  const runflowDir = path.join(cwd, '.runflow')
  const runsDir = path.join(runflowDir, 'runs')
  const latestFile = path.join(runsDir, 'latest.json')

  try {
    if (!existsSync(runsDir)) {
      mkdirSync(runsDir, { recursive: true })
    }
    // Omit finalParams from the snapshot file
    const { finalParams, ...snapshot } = result
    const data = JSON.stringify(snapshot, null, 2)
    writeFileSync(latestFile, data, 'utf-8')
  }
  catch (error) {
    console.error('Failed to save run snapshot:', error)
  }
}
