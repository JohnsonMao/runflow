import type { FlowDefinition, FlowStep, ParamDeclaration } from '@runflow/core'
import type { CollectedOperation } from './collectOperations.js'
import type { ApiParamDeclaration } from './mapParams.js'
import type { OpenApiDocument, ParamExposeConfig } from './types.js'
import { mapParamsToDeclarations } from './mapParams.js'

const DEFAULT_PARAM_EXPOSE: ParamExposeConfig = {
  path: true,
  query: true,
  body: true,
  header: false,
  cookie: false,
}

function filterParamsByExpose(params: ApiParamDeclaration[], paramExpose?: ParamExposeConfig): ParamDeclaration[] {
  const expose = paramExpose ?? DEFAULT_PARAM_EXPOSE
  return params.filter((p) => {
    if (p.in == null)
      return true
    return expose[p.in] !== false
  })
}

export interface OperationToFlowOptions {
  paramExpose?: ParamExposeConfig
  stepType?: string
}

export function operationToFlow(
  doc: OpenApiDocument,
  op: CollectedOperation,
  baseUrl: string,
  options?: OperationToFlowOptions,
): FlowDefinition {
  const paramExpose = options?.paramExpose
  const stepType = options?.stepType ?? 'http' // fallback for direct callers; workspace always passes stepType

  const rawParams = mapParamsToDeclarations(op, doc)
  const params = filterParamsByExpose(rawParams, paramExpose)
  const pathWithTemplates = op.path.replace(/\{(\w+)\}/g, '{{ params.$1 }}')
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${pathWithTemplates}` : pathWithTemplates
  const apiStepId = 'api'
  const apiStep: FlowStep = {
    id: apiStepId,
    type: stepType,
    url,
    pathname: pathWithTemplates,
    method: op.method,
    dependsOn: [],
  }
  const bodyParam = rawParams.find(p => p.name === 'body')
  if (bodyParam) {
    (apiStep as Record<string, unknown>).body = '{{ params.body }}'
  }

  const steps: FlowStep[] = [apiStep]

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
