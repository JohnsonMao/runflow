## 1. Convention-to-flow adapter (package and interface)

- [x] 1.1 Add package `packages/convention-openapi` (or `@runflow/openapi`) with tsconfig and build (e.g. tsup), and wire in pnpm workspace
- [x] 1.2 Define adapter interface: `openApiToFlows(specPathOrObject, options?)` returning flow objects (or array/Map keyed by operation); options SHALL include output mode (memory-only or outputDir), MAY include baseUrl, operationFilter (path/method), and hooks (per-operation before/after step definitions)
- [x] 1.3 Implement OpenAPI 3.x document loading (file path or in-memory object); support reading paths, pathItem methods, parameters, requestBody

## 2. OpenAPI → flow mapping

- [x] 2.1 Map each path+method to one flow: generate `name`, `params` (from path/query/header/body), and `steps` array
- [x] 2.2 Generate flow `params` declaration from OpenAPI parameters (path, query, header) and optional requestBody; map types to string/number/boolean/array/object
- [x] 2.3 Emit steps with `type: 'http'`: set url (from server + path with path params), method, headers, body from requestBody; use template placeholders for params (e.g. `{{ params.id }}`)
- [x] 2.4 Add unit tests: given a minimal OpenAPI YAML, assert produced flow has correct name, params, and one http step with expected url/method

## 3. Conversion-time hooks and in-memory output

- [x] 3.1 In adapter, accept optional `hooks` option: per-operation (path+method or operationId) before/after step definitions; when present, for each generated flow insert those steps and set `dependsOn` so order is [before] → [API step] → [after]; emit only plain steps (no before/after on any step)
- [x] 3.2 Support different before/after steps per operation; ensure inserted step ids are unique within each flow (e.g. prefix/suffix by operation)
- [x] 3.3 Implement in-memory-only output: when output mode is memory (or no outputDir), return flow(s) as object(s) without writing to filesystem; support returning single flow or collection for many APIs
- [x] 3.4 Add tests: adapter with hooks produces correct step order and dependsOn; in-memory mode returns flows without writing files

## 4. Integration and CLI (optional)

- [x] 4.1 From CLI or test: load OpenAPI file → call adapter → run one generated flow with `run(flow, { params })` and assert execution (e.g. mock http or real request)
- [x] 4.2 (Optional) Add CLI flag e.g. `runflow run --from-openapi <file> --operation <method> <path>` that uses adapter and runs the chosen flow with params from args or file
- [x] 4.3 Document convention-to-flow usage, per-operation hooks at conversion time, and in-memory output in README or docs

## 5. Verification and cleanup

- [x] 5.1 Run full test suite (core + convention-openapi); fix any regressions
- [x] 5.2 Lint and typecheck; ensure new code follows project conventions (types in types.ts, describe/it, lint:fix)
