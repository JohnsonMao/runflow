import type { FlowDefinition, FlowStep } from '@runflow/core'
import type { CollectedOperation } from './collectOperations.js'
import type { OpenApiDocument } from './types.js'
import { mapParamsToDeclarations } from './mapParams.js'

export function operationToFlow(
  doc: OpenApiDocument,
  op: CollectedOperation,
  baseUrl: string,
): FlowDefinition {
  const params = mapParamsToDeclarations(op)
  const pathWithTemplates = op.path.replace(/\{(\w+)\}/g, '{{ params.$1 }}')
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${pathWithTemplates}` : pathWithTemplates
  const apiStepId = 'api'

  const httpStep: FlowStep = {
    id: apiStepId,
    type: 'http',
    url,
    method: op.method,
    dependsOn: [],
  }
  const bodyParam = params.find(p => p.name === 'body')
  if (bodyParam) {
    (httpStep as Record<string, unknown>).body = '{{ params.body }}'
  }

  const steps: FlowStep[] = [httpStep]

  const operation = op.operation as { summary?: string, description?: string, tags?: string[] }
  const flow: FlowDefinition & { tags?: string[] } = {
    name: operation.summary ?? op.key,
    description: operation.description,
    params,
    steps,
  }
  if (operation.tags?.length)
    flow.tags = operation.tags
  return flow
}
