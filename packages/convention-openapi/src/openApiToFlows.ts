import type { OpenApiDocument, OpenApiToFlowsOptions, OpenApiToFlowsResult, OperationKey } from './types.js'
import { applyHooks } from './applyHooks.js'
import { collectOperations } from './collectOperations.js'
import { loadOpenApiDocument } from './loadOpenApi.js'
import { operationToFlow } from './operationToFlow.js'
import { resolveHooksForKey } from './resolveHooks.js'
import { writeFlowsToDir } from './writeFlows.js'

/**
 * Convert OpenAPI spec to Runflow flow(s). One flow per operation (path+method).
 * Key is filename-safe: e.g. get-users, get-users-id (same as written flow filename). When output is 'memory' (default), returns a Map without writing files.
 */
export async function openApiToFlows(
  specPathOrObject: string | OpenApiDocument,
  options: OpenApiToFlowsOptions = {},
): Promise<OpenApiToFlowsResult> {
  const doc = await loadOpenApiDocument(specPathOrObject)
  const operations = collectOperations(doc, options.operationFilter)
  const baseUrl = options.baseUrl ?? doc.servers?.[0]?.url ?? ''
  const result: OpenApiToFlowsResult = new Map()

  for (const op of operations) {
    let flow = operationToFlow(doc, op, baseUrl)
    const resolvedHooks = resolveHooksForKey(op.key, options.hooks)
    if (resolvedHooks)
      flow = applyHooks(flow, op.key, resolvedHooks)
    result.set(op.key, flow)
  }

  const output = options.output ?? 'memory'
  if (output !== 'memory' && typeof output === 'object' && output.outputDir) {
    await writeFlowsToDir(result, output.outputDir)
  }

  return result
}

export type { OperationKey }
