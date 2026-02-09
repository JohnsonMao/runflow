import type { OpenApiToFlowsResult } from './types.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'

function safeFileName(key: string): string {
  return key.replace(/\s+/g, '-').replace(/\//g, '-').replace(/[^\w-]/g, '') || 'flow'
}

export async function writeFlowsToDir(result: OpenApiToFlowsResult, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true })
  for (const [key, flow] of result) {
    const name = safeFileName(key)
    const path = join(outputDir, `${name}.yaml`)
    await writeFile(path, stringify(flow), 'utf-8')
  }
}
