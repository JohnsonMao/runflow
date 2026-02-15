import type { ResolveFlowFn } from '@runflow/core'
import type { RunflowConfig } from './config'
import { existsSync, statSync } from 'node:fs'
import { openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile } from '@runflow/core'
import { resolveFlowId } from './config'

export function createResolveFlow(
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): ResolveFlowFn {
  return async (flowId: string) => {
    const resolved = resolveFlowId(flowId, config, configDir, cwd)
    if (resolved.type === 'openapi') {
      if (!existsSync(resolved.specPath) || !statSync(resolved.specPath).isFile())
        return null
      const flows = await openApiToFlows(resolved.specPath, { ...resolved.options, output: 'memory' })
      const selected = flows.get(resolved.operation)
      if (!selected)
        return null
      return { flow: selected, flowFilePath: resolved.specPath }
    }
    if (!existsSync(resolved.path) || !statSync(resolved.path).isFile())
      return null
    const loaded = loadFromFile(resolved.path)
    if (!loaded)
      return null
    return { flow: loaded, flowFilePath: resolved.path }
  }
}
