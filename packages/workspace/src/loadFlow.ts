import type { FlowDefinition } from '@runflow/core'
import type { ResolvedFlow, RunflowConfig } from './config'
import { existsSync, statSync } from 'node:fs'
import { openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile } from '@runflow/core'
import { resolveFlowId } from './config'

export interface LoadedFlow {
  flow: FlowDefinition
  flowFilePath: string
}

/**
 * Resolve flowId to a concrete flow and load it. Single place for "resolve + load" used by CLI and MCP.
 * @throws Error with user-facing message when file/spec not found, operation not found, or flow invalid.
 */
export async function loadFlowFromResolved(resolved: ResolvedFlow): Promise<LoadedFlow> {
  if (resolved.type === 'openapi') {
    if (!existsSync(resolved.specPath) || !statSync(resolved.specPath).isFile())
      throw new Error(`OpenAPI spec not found: ${resolved.specPath}`)
    const flows = await openApiToFlows(resolved.specPath, { ...resolved.options, output: 'memory' })
    const selected = flows.get(resolved.operation)
    if (!selected) {
      const keys = [...flows.keys()].slice(0, 10).join(', ')
      throw new Error(`Operation "${resolved.operation}" not found. Available (sample): ${keys}${flows.size > 10 ? '...' : ''}`)
    }
    return { flow: selected, flowFilePath: resolved.specPath }
  }
  if (!existsSync(resolved.path) || !statSync(resolved.path).isFile())
    throw new Error(`File not found or not a regular file: ${resolved.path}`)
  const flow = loadFromFile(resolved.path)
  if (!flow)
    throw new Error('Invalid or unreadable flow file.')
  return { flow, flowFilePath: resolved.path }
}

/**
 * Resolve flowId and load the flow. Convenience for callers that have config/configDir/cwd.
 */
export async function resolveAndLoadFlow(
  flowId: string,
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): Promise<LoadedFlow> {
  const resolved = resolveFlowId(flowId, config, configDir, cwd)
  return loadFlowFromResolved(resolved)
}
