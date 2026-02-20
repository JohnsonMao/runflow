import type { FlowStep } from '@runflow/core'
import type { OpenApiDocument } from './types.js'
import { collectOperations } from './collectOperations.js'
import { loadOpenApiDocument } from './loadOpenApi.js'

export interface ValidateRequestContext {
  openApiSpecPath?: string
  openApiOperationKey?: string
  [key: string]: unknown
}

export interface ValidateRequestResult {
  valid: boolean
  error?: string
}

/**
 * Validate the request (step) against the OpenAPI operation. Reads openApiSpecPath and openApiOperationKey from context (or context.params).
 * Returns { valid: true } when context does not provide spec/operation (no validation). When provided, loads spec and validates step body against requestBody schema when present.
 */
export async function validateRequest(
  step: FlowStep,
  context: ValidateRequestContext,
): Promise<ValidateRequestResult> {
  const specPath = context.openApiSpecPath ?? (context.params as Record<string, unknown> | undefined)?.openApiSpecPath
  const operationKey = context.openApiOperationKey ?? (context.params as Record<string, unknown> | undefined)?.openApiOperationKey

  if (typeof specPath !== 'string' || typeof operationKey !== 'string')
    return { valid: true }

  let doc: OpenApiDocument
  try {
    doc = await loadOpenApiDocument(specPath)
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { valid: false, error: `Failed to load OpenAPI spec: ${message}` }
  }

  const operations = collectOperations(doc)
  const op = operations.find(o => o.key === operationKey)
  if (!op)
    return { valid: false, error: `Operation not found: ${operationKey}` }

  const operation = op.operation as { requestBody?: { required?: boolean, content?: Record<string, { schema?: unknown }> } }
  const bodyContent = operation.requestBody?.content?.['application/json']
  if (operation.requestBody?.required && bodyContent?.schema) {
    const body = (step as { body?: unknown }).body
    if (body === undefined || body === null || body === '')
      return { valid: false, error: 'Request body is required but missing' }
    if (typeof body === 'string') {
      try {
        JSON.parse(body)
      }
      catch {
        return { valid: false, error: 'Request body is not valid JSON' }
      }
    }
  }

  return { valid: true }
}
