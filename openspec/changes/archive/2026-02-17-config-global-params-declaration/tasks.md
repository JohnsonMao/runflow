## 1. Workspace (config type and loadConfig)

- [x] 1.1 Change RunflowConfig.params type from Record<string, unknown> to ParamDeclaration[] (optional) in packages/workspace/src/config.ts
- [x] 1.2 In loadConfig, when params is a plain object (legacy), normalize to ParamDeclaration[] (each key → { name: key, type: "string", default: value }); return normalized array
- [x] 1.3 Add unit tests for loadConfig with params as array and params as legacy object (normalization)

## 2. Core (RunOptions and executor)

- [x] 2.1 Add effectiveParamsDeclaration?: ParamDeclaration[] to RunOptions in packages/core/src/types.ts
- [x] 2.2 In executor run(), when effectiveParamsDeclaration is provided, use it for params schema build and validation instead of flow.params; when absent, keep current behavior (flow.params only)
- [x] 2.3 Add unit tests: run() with effectiveParamsDeclaration validates and applies defaults; run() without it unchanged

## 3. Helper: merge effective declaration

- [x] 3.1 Add mergeParamDeclarations(configParams, flowParams): ParamDeclaration[] in packages/workspace (or core) that merges with flow override on same name; export for CLI/MCP use
- [x] 3.2 Add unit tests for mergeParamDeclarations (flow overrides config for same name; flow adds new param)

## 4. CLI

- [x] 4.1 When config is loaded and has params, compute effectiveParamsDeclaration = mergeParamDeclarations(config.params, flow.params); pass to run() in options
- [x] 4.2 Build initial options.params from effective declaration defaults then -f then --param (existing merge order); pass to run()
- [x] 4.3 Add or update CLI tests for run with config params (effective declaration and validation)

## 5. MCP server

- [x] 5.1 When executing a flow, if config has params, compute effectiveParamsDeclaration and pass to run(); build options.params from tool params and declaration defaults
- [x] 5.2 Add or update MCP tests for execute with config params

## 6. Examples and docs

- [x] 6.1 Migrate examples/config/runflow.config.json params from object to ParamDeclaration array
- [x] 6.2 Update examples/README.md (and root README if needed) to document config params as declaration array and flow override
