## 1. Config OpenAPI and allowedCommands types

- [x] 1.1 Define OpenAPI config shape (e.g. in cli or shared types): openapi.specPath, openapi.outDir, openapi.baseUrl, openapi.operationFilter, openapi.hooks; extend RunflowConfig interface; add allowedCommands to RunflowConfig and RunOptions/StepContext
- [x] 1.2 Resolve openapi paths (specPath, outDir) relative to config file directory in CLI when loading config
- [x] 1.3 When invoking openApiToFlows with --from-openapi, merge config.openapi options with CLI defaults (output: 'memory' for run); CLI flags override config when both present

## 2. CLI integration

- [x] 2.1 Pass merged openapi options from config into openApiToFlows in run action (baseUrl, operationFilter, hooks; outDir when writing flows)
- [x] 2.2 Add or update tests: config with openapi block is used for --from-openapi; path resolution relative to config dir
- [x] 2.3 Update help or README to state that OpenAPI options can be set in config and overridden by CLI

## 3. Examples convergence

- [x] 3.1 Decide final keep list: hello-flow, params-flow, params-schema-flow, dag-linear-flow, dag-parallel-flow, http-flow, js-file-flow, custom-handler/; document removed files (mixed-flow, new-steps-flow, condition-flow, params.json, step.js if redundant)
- [x] 3.2 Remove or merge redundant example files per 3.1; ensure custom-handler/ and its runflow.config.mjs remain
- [x] 3.3 Add or update examples/README.md with representative list and short description per example
- [x] 3.4 Update project README (and any other docs) so links to examples point only to converged files; remove references to deleted examples

## 4. Command allowed list (security)

- [x] 4.1 Add RunOptions.allowedCommands and StepContext.allowedCommands; executor passes to step context; command handler checks first-token against list, default list when undefined, empty array = no commands
- [x] 4.2 CLI: read config.allowedCommands and pass to run(); document in README

## 5. Verification

- [x] 5.1 Run existing CLI tests and fix any that depend on removed examples (e.g. paths or fixtures)
- [x] 5.2 Manually verify: flow run with --from-openapi and config containing openapi block uses config options; examples dir contains only representative set and docs are consistent
