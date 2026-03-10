import type { OpenApiToFlowsResult } from './types.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'

function safeFileName(key: string): string {
  return key.replace(/\s+/g, '-').replace(/\//g, '-').replace(/[^\w-]/g, '') || 'flow'
}

export async function writeFlowsToDir(result: OpenApiToFlowsResult, outputDir: string, handlerKey?: string): Promise<void> {
  // If handlerKey is provided, organize flows into subdirectories by handler key
  const targetDir = handlerKey ? join(outputDir, handlerKey) : outputDir
  await mkdir(targetDir, { recursive: true })
  for (const [key, flow] of result) {
    const name = safeFileName(key)
    const path = join(targetDir, `${name}.yaml`)
    await writeFile(path, stringify(flow), 'utf-8')
  }
}
