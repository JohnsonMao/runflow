## 1. convention-openapi: Remove hooks

- [x] 1.1 Remove from types: OperationHooks, HooksEntry, StepDef, and hooks from OpenApiToFlowsOptions in packages/convention-openapi/src/types.ts
- [x] 1.2 Delete packages/convention-openapi/src/resolveHooks.ts and applyHooks.ts
- [x] 1.3 In openApiToFlows.ts remove hooks parameter and any applyHooks call; ensure flow has single API step (http or override)
- [x] 1.4 Remove resolveHooks/applyHooks from exports and update all tests (openApiToFlows.test.ts, applyHooks.test.ts, resolveHooks.test.ts – delete or rewrite)

## 2. convention-openapi: paramExpose

- [x] 2.1 Add ParamExposeConfig type (path?, query?, body?, header?, cookie? booleans) and add to OpenApiToFlowsOptions in types.ts
- [x] 2.2 In openApiToFlows (or operationToFlow), after mapParamsToDeclarations, filter params by paramExpose (default: path/query/body true, header/cookie false)
- [x] 2.3 Add unit tests: default paramExpose filters out header/cookie; custom paramExpose respects overrides

## 3. convention-openapi: Override and step generation

- [x] 3.1 Add override?: string to OpenApiToFlowsOptions (handler name or module path)
- [x] 3.2 When override is set, generate step with type = override handler type and payload = url, method, headers, body (same as http); do not add openApiSpecPath/openApiOperationKey to step
- [x] 3.3 Resolve override: if string matches config.handlers key use that handler; else load module from path and register; determine step type for generated step (done in workspace when building options)
- [x] 3.4 Add unit tests: with override, flow has one step of override type with http-like payload; without override, step remains type http

## 4. convention-openapi: validateRequest and context

- [x] 4.1 Export validateRequest(step, context): { valid: boolean, error?: string } that reads context.openApiSpecPath and context.openApiOperationKey, loads spec, gets operation, validates step (e.g. body against requestBody schema)
- [x] 4.2 Add unit tests for validateRequest (valid/invalid body, missing context keys)

## 5. workspace: Config and resolve

- [x] 5.1 In config types (openapi entry), remove hooks; add paramExpose (optional), override (optional)
- [x] 5.2 When resolving OpenAPI flow, ensure createResolveFlow or loadFlow can provide openApiSpecPath and openApiOperationKey to the caller (e.g. on ResolvedFlow or via a helper) so runner can inject into context
- [x] 5.3 Pass paramExpose and override from config to openApiToFlows options; remove hooks from options

## 6. workspace: Format

- [x] 6.1 In format.ts remove API_PARAM_INS and the filter that restricts to path/query/body; use flow.params as-is for param display
- [x] 6.2 Update format tests if they relied on filtered params

## 7. CLI / MCP (runner context injection)

- [x] 7.1 When running an OpenAPI-derived flow, before run(), add openApiSpecPath and openApiOperationKey to options.params (or initial context) when the resolved flow indicates OpenAPI source (use ResolvedFlow or resolve metadata)
- [x] 7.2 Ensure createResolveFlow returns or exposes openApiSpecPath and openApiOperationKey for prefix-operation flowIds so CLI/MCP can inject

## 8. Examples and main spec

- [x] 8.1 Remove hooks from examples/config/runflow.config.json; optionally add paramExpose and override example
- [x] 8.2 Update openspec/specs/config-openapi/spec.md: remove hooks requirements; add paramExpose, override, and context (validateRequest) requirements from this change's delta
