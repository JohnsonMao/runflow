import type { OpenApiDocument } from './types.js'
import SwaggerParser from '@apidevtools/swagger-parser'

/**
 * Load OpenAPI 3.x document. When given a file path (string), uses @apidevtools/swagger-parser
 * to resolve $ref and return a single resolved spec. When given an in-memory object, returns it as-is
 * (no $ref resolution; use a path if the spec contains $ref).
 */
export async function loadOpenApiDocument(
  specPathOrObject: string | OpenApiDocument,
): Promise<OpenApiDocument> {
  if (typeof specPathOrObject !== 'string') {
    return specPathOrObject
  }
  const resolved = await SwaggerParser.dereference(specPathOrObject)
  return resolved as OpenApiDocument
}
