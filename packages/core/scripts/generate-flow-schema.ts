/**
 * Generate flow.schema.json by reading packages/core/src/types.ts with the TypeScript
 * Compiler API. Single source of truth: types.ts (FlowDefinition and dependencies).
 * Run: pnpm --filter @runflow/core generate:schema
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const outPath = join(distDir, 'flow.schema.json')
const typesPath = join(rootDir, 'src', 'types.ts')
const tsconfigPath = join(rootDir, 'tsconfig.json')

const DEFINITION_NAMES = [
  'ParamType',
  'ParamDeclarationWithoutName',
  'ParamDeclaration',
  'FlowStep',
  'FlowDefinition',
] as const

type DefinitionName = (typeof DEFINITION_NAMES)[number]

function createProgramFromTypesFile(): { program: ts.Program, sourceFile: ts.SourceFile } {
  const configContent = readFileSync(tsconfigPath, 'utf-8')
  const config = ts.parseJsonSourceFileConfigFileContent(
    ts.parseJsonText(tsconfigPath, configContent),
    { getCurrentDirectory: () => rootDir, fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory, useCaseSensitiveFileNames: true },
    dirname(tsconfigPath),
  )
  const program = ts.createProgram(config.fileNames, config.options, ts.createCompilerHost(config.options))
  const sourceFile = program.getSourceFile(typesPath)
  if (!sourceFile)
    throw new Error(`Source file not found: ${typesPath}`)
  return { program, sourceFile }
}

function findExportedDeclarations(
  sourceFile: ts.SourceFile,
  names: readonly string[],
): Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration> {
  const map = new Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>()
  const nameSet = new Set(names)
  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const name = node.name.getText(sourceFile)
      if (nameSet.has(name) && hasExportModifier(node))
        map.set(name, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return map
}

function hasExportModifier(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
}

function getJSDocDescription(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const full = sourceFile.getFullText()
  const ranges = ts.getLeadingCommentRanges(full, node.getFullStart())
  if (!ranges?.length)
    return undefined
  const text = ranges.map(r => full.slice(r.pos, r.end)).join('')
  const match = text.match(/\*\s*([^*]+)/)
  return match ? match[1].trim().replace(/\s*\*\s*$/gm, '').trim() : undefined
}

function typeToJsonSchema(
  type: ts.Type,
  defName: DefinitionName,
  checker: ts.TypeChecker,
  definitionTypes: Map<DefinitionName, ts.Type>,
  refNode: ts.Node,
  visited: Set<ts.Type> = new Set(),
): Record<string, unknown> {
  if (visited.has(type)) {
    for (const [name, defType] of definitionTypes) {
      if (defType === type)
        return { $ref: `#/definitions/${name}` }
    }
    return {}
  }
  visited.add(type)
  const sym = type.getSymbol()
  const typeName = sym?.getName()
  if (typeName && DEFINITION_NAMES.includes(typeName as DefinitionName)) {
    const other = typeName as DefinitionName
    if (other !== defName) {
      visited.delete(type)
      return { $ref: `#/definitions/${typeName}` }
    }
  }
  // Anonymous type (e.g. Omit<ParamDeclaration,'name'>): match by identity to break cycles
  if (!typeName || !DEFINITION_NAMES.includes(typeName as DefinitionName)) {
    for (const [name, defType] of definitionTypes) {
      if (name !== defName && defType === type) {
        visited.delete(type)
        return { $ref: `#/definitions/${name}` }
      }
    }
  }

  // Union: strip undefined/null then handle
  const isUnion = (type.getFlags() & ts.TypeFlags.Union) !== 0
  if (isUnion) {
    const options = (type as ts.UnionOrIntersectionType).types.filter(
      t => (t.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) === 0,
    )
    if (options.length === 0)
      return {}
    if (options.length === 1) {
      const out = typeToJsonSchema(options[0], defName, checker, definitionTypes, refNode, visited)
      visited.delete(type)
      return out
    }
    const literals = options
      .map(t => (t.getFlags() & ts.TypeFlags.StringLiteral ? (t as ts.StringLiteralType).value : null))
      .filter((v): v is string => v !== null)
    if (literals.length === options.length) {
      visited.delete(type)
      return { type: 'string', enum: literals }
    }
  }

  // Array: TypeReference to Array<T>
  const typeRef = type as ts.TypeReference
  if (type.getSymbol()?.getName() === 'Array' && typeRef.typeArguments?.[0]) {
    const out = { type: 'array' as const, items: typeToJsonSchema(typeRef.typeArguments[0], defName, checker, definitionTypes, refNode, visited) }
    visited.delete(type)
    return out
  }

  // Record<K,V> / index signature value
  if (type.getSymbol()?.getName() === 'Record') {
    const typeArgs = (type as ts.TypeReference).typeArguments
    const valueType = typeArgs?.[1]
    if (valueType) {
      const out = { type: 'object' as const, additionalProperties: typeToJsonSchema(valueType, defName, checker, definitionTypes, refNode, visited) }
      visited.delete(type)
      return out
    }
  }

  // Primitives
  const flags = type.getFlags()
  if (flags & ts.TypeFlags.String) {
    visited.delete(type)
    return { type: 'string' }
  }
  if (flags & ts.TypeFlags.Number) {
    visited.delete(type)
    return { type: 'number' }
  }
  if (flags & ts.TypeFlags.Boolean) {
    visited.delete(type)
    return { type: 'boolean' }
  }
  if (flags & ts.TypeFlags.Unknown || flags & ts.TypeFlags.Any) {
    visited.delete(type)
    return {}
  }

  // Object with properties
  const props = checker.getPropertiesOfType(type)
  if (props.length > 0) {
    const properties: Record<string, Record<string, unknown>> = {}
    const required: string[] = []
    for (const prop of props) {
      const propName = prop.getName()
      const propType = checker.getTypeOfSymbolAtLocation(prop, refNode)
      const decls = prop.getDeclarations()
      const optional = decls?.some((d) => {
        if (ts.isPropertySignature(d))
          return d.questionToken !== undefined
        return false
      }) ?? true
      const decl = decls?.[0]
      const desc = decl && ts.isPropertySignature(decl) ? getJSDocDescription(decl, decl.getSourceFile()) : undefined
      const schema: Record<string, unknown> = typeToJsonSchema(propType, defName, checker, definitionTypes, refNode, visited)
      if (desc)
        schema.description = desc
      properties[propName] = schema
      if (!optional)
        required.push(propName)
    }
    visited.delete(type)
    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    }
  }

  visited.delete(type)
  return {}
}

function hasStringIndexSignature(node: ts.InterfaceDeclaration): boolean {
  return node.members.some(m => ts.isIndexSignatureDeclaration(m))
}

/** Build object schema from interface AST when getPropertiesOfType is empty (single-file program). */
function schemaFromInterfaceMembers(
  decl: ts.InterfaceDeclaration,
  defName: DefinitionName,
  checker: ts.TypeChecker,
  definitionTypes: Map<DefinitionName, ts.Type>,
  sourceFile: ts.SourceFile,
): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []
  for (const member of decl.members) {
    if (ts.isPropertySignature(member)) {
      const name = member.name && ts.isIdentifier(member.name) ? member.name.text : undefined
      if (!name)
        continue
      const optional = member.questionToken !== undefined
      const propType = member.type ? checker.getTypeAtLocation(member.type) : checker.getTypeAtLocation(member)
      const schema: Record<string, unknown> = typeToJsonSchema(propType, defName, checker, definitionTypes, member)
      const desc = getJSDocDescription(member, sourceFile)
      if (desc)
        schema.description = desc
      properties[name] = schema
      if (!optional)
        required.push(name)
    }
  }
  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  }
}

/** Build JSON Schema definitions by reading types from types.ts. */
function buildDefinitionsFromTypes(): Record<string, Record<string, unknown>> {
  const { program, sourceFile } = createProgramFromTypesFile()
  const checker = program.getTypeChecker()
  const declarations = findExportedDeclarations(sourceFile, [...DEFINITION_NAMES])
  const definitionTypes = new Map<DefinitionName, ts.Type>()
  for (const defName of DEFINITION_NAMES) {
    const decl = declarations.get(defName)
    if (!decl)
      continue
    const typeNode = ts.isTypeAliasDeclaration(decl) ? decl.type : decl.name
    definitionTypes.set(defName, checker.getTypeAtLocation(typeNode))
  }

  const definitions = new Map<DefinitionName, Record<string, unknown>>()
  for (const defName of DEFINITION_NAMES) {
    const decl = declarations.get(defName)
    if (!decl)
      continue
    const type = definitionTypes.get(defName)!
    let schema = typeToJsonSchema(type, defName, checker, definitionTypes, decl.name)
    if (ts.isInterfaceDeclaration(decl) && (!schema.properties || Object.keys(schema.properties).length === 0))
      schema = schemaFromInterfaceMembers(decl, defName, checker, definitionTypes, sourceFile)
    if (schema.type === 'object' && schema.properties) {
      const obj = schema as Record<string, unknown>
      if (defName === 'FlowStep' && ts.isInterfaceDeclaration(decl) && hasStringIndexSignature(decl))
        obj.additionalProperties = true
      else if (defName !== 'FlowStep')
        obj.additionalProperties = false
      const description = getJSDocDescription(decl, sourceFile)
      if (description)
        obj.description = description
    }
    definitions.set(defName, schema)
  }

  const out: Record<string, Record<string, unknown>> = {}
  for (const name of DEFINITION_NAMES) {
    const s = definitions.get(name)
    if (s)
      out[name] = s
  }
  return out
}

/** Build full flow JSON Schema (draft 2020-12). */
export function buildFlowSchema(): Record<string, unknown> {
  const definitions = buildDefinitionsFromTypes()
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://runflow.dev/flow.schema.json',
    title: 'Runflow Flow',
    description:
      'Flow definition (name, optional params, steps with id, type, optional dependsOn)',
    $ref: '#/definitions/FlowDefinition',
    definitions,
  }
}

/** Generate flow.schema.json into dist/. Callable from tests or when run as script. */
export function generateFlowSchema(): void {
  const schema = buildFlowSchema()
  mkdirSync(distDir, { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8')
  console.log('Wrote', outPath)
}

function isMainModule(moduleUrl: string): boolean {
  if (!process.argv[1])
    return false
  const resolved = resolve(process.cwd(), process.argv[1])
  return fileURLToPath(moduleUrl) === resolved
}

if (isMainModule(import.meta.url)) {
  generateFlowSchema()
}
