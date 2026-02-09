# @runflow/convention-openapi

Convert OpenAPI 3.x specs to Runflow flows. One flow per operation (path + method). Operation key is filename-safe: lowercase method and path with slashes/braces as hyphens (e.g. `get-users`, `get-users-id` for `/users/{id}`) for stable, filename-safe keys. When loading from a file path, `@apidevtools/swagger-parser` is used to resolve `$ref`. Use with `@runflow/core` to run generated flows.

## Usage

### In-memory (default)

Generate flows without writing files. Best when you have many operations.

```ts
import { openApiToFlows } from '@runflow/convention-openapi'
import { run } from '@runflow/core'

const flows = await openApiToFlows('./openapi.yaml', { output: 'memory' })

for (const [operationKey, flow] of flows) {
  const result = await run(flow, { params: { id: '1' } })
  console.log(operationKey, result.success)
}
```

### Write to directory

```ts
await openApiToFlows('./openapi.yaml', {
  output: { outputDir: './generated-flows' },
})
```

### Per-operation hooks (conversion time)

Insert steps before and after the API step for specific operations. Steps are wired with `dependsOn` only (no `before`/`after` on steps).

```ts
const flows = await openApiToFlows('./openapi.yaml', {
  output: 'memory',
  baseUrl: 'https://api.example.com',
  hooks: {
    'get-users': {
      before: [{ type: 'js', run: 'return { token: params.token }' }],
      after: [{ type: 'js', run: 'console.log(params.api); return {}' }],
    },
  },
})
```

Step `id` in hook definitions is optional; the adapter auto-generates unique ids when missing. If you provide an `id`, it is used as-is. Hook steps can specify `dependsOn`; the adapter merges them (before steps keep their deps; after steps get api step id merged in).

**Batch hooks with regex:** pass `hooks` as an array of `{ pattern: string | RegExp, hooks }`. All matching operations get the same before/after steps (concatenated when multiple entries match).

```ts
hooks: [
  { pattern: /^get /, hooks: { before: [{ type: 'js', run: 'return {}' }] } },
  { pattern: 'POST /users', hooks: { after: [{ type: 'js', run: 'return {}' }] } },
]
```

### Options

- **output**: `'memory'` (default) or `{ outputDir: string }`
- **baseUrl**: Base URL for the API (e.g. `https://api.example.com`)
- **operationFilter**: `{ method?, path?, operationId?, tags? }` to limit which operations are converted
- **hooks**: `Record<operationKey, OperationHooks>` for exact key, or `HooksEntry[]` (pattern = string or RegExp) for batch

### Flow metadata

- Flow `name` comes from `operation.summary` or falls back to operation key.
- Flow `description` from `operation.description`.
- When present, `operation.tags` are set on the generated flow as `tags: string[]`.

## Requirements

- OpenAPI 3.x document (YAML or JSON). When loading from a **file path**, `$ref` are resolved via `@apidevtools/swagger-parser`; in-memory object is returned as-is.
- Supported: `paths`, path item methods, `parameters` (path/query/header, with schema/description), `requestBody` (application/json schema; params include nested schema/items for object/array)
- Generated flows use step type `http` from `@runflow/core`
