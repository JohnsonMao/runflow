# Tasks

## 1. Types and params declaration

- [x] 1.1 In `packages/core/src/types.ts`: add optional `params?: ParamDeclaration[]` to `FlowDefinition`; define `ParamDeclaration` (name, type, required?, default?, enum?, description?, schema?, items?).
- [x] 1.2 Change `RunOptions.params` from `Record<string, string>` to `Record<string, unknown>`; add optional `flowFilePath?: string` to `RunOptions` for resolving js step `file`.
- [x] 1.3 Add dependency `zod` in `packages/core`; implement `paramsDeclarationToZodSchema(declaration)` (recursive for object schema and array items).

## 2. Parser: top-level params and js step file

- [x] 2.1 In `packages/core/src/parser.ts`: parse top-level `params` array; each item has name, type; optional required, default, enum, description, schema (recursive), items.
- [x] 2.2 For steps with `type: 'js'`: accept optional `file` (string); if `file` present, `run` may be omitted; if `file` absent, `run` required. Reject js step with neither or invalid file (e.g. non-string).
- [x] 2.3 Export or use parsed params in `FlowDefinition`; ensure parser tests cover params and js file.

## 3. Executor: params validation and context

- [x] 3.1 At start of `run(flow, options)`: if `flow.params` exists, build Zod schema and run `schema.safeParse(options.params)`; on failure, throw or return RunResult with error, do not execute steps.
- [x] 3.2 When validation passes, set initial context to parsed result (or options.params when no schema). Context remains `Record<string, unknown>` for accumulation with step outputs.

## 4. Template substitution

- [x] 4.1 Implement `substitute(template: string, context: Record<string, unknown>): string`: parse `{{ path }}` (path = identifier, .prop, [index]); resolve path; undefined/null → ""; object/array → JSON.stringify; else String(value).
- [x] 4.2 In executor, before running a command step: replace `step.run` with `substitute(step.run, context)` and pass result to shell.
- [x] 4.3 Add unit tests for substitute: root key, dot, bracket, mixed, undefined, null, object, array.

## 5. Executor: js step file loading

- [x] 5.1 When executing a js step with `file`: resolve path with `path.resolve(path.dirname(options.flowFilePath!), step.file)` (fail step if no flowFilePath or file not .js).
- [x] 5.2 Read file content (utf-8); if file missing or unreadable, set step result success false and error message.
- [x] 5.3 Execute loaded code with same VM and context/return semantics as inline run; merge outputs into context.

## 6. CLI: --params-file and merge

- [x] 6.1 Add option `--params-file <path>` (and `-f`) to `flow run <file>`; read JSON file, parse as object; on invalid file or non-object, exit with error.
- [x] 6.2 Merge params: start with params from file (or {}); then apply each --param key=value (later overwrites). Pass merged object to `run(flow, { params, flowFilePath })`.
- [x] 6.3 Ensure flow file path is passed: when invoking run(), set `flowFilePath` to the absolute path of the flow file.

## 7. CLI: optional params list / hint

- [x] 7.1 (Optional) Add subcommand or flag to list flow params (e.g. `flow params flow.yaml` or `flow run --show-params`): output required, type, enum, description from flow.params for user reference.

## 8. Tests

- [x] 8.1 Core: flow with params declaration; run with valid params → validation passes and steps see context.
- [x] 8.2 Core: run with missing required or wrong type → validation fails before any step, clear error.
- [x] 8.3 Core: command step with `{{ a }}`, `{{ obj.b }}`, `{{ arr[0] }}`, object/array → correct substitution.
- [x] 8.4 Core: js step with file (relative to flow), file exists → runs and outputs; file missing → step fails.
- [x] 8.5 CLI: flow run with --params-file and --param → merge order correct, params passed to run.
- [x] 8.6 CLI: --params-file with missing or invalid JSON → exit with error.

## 9. Verify and docs

- [x] 9.1 Run `pnpm test` and `pnpm run check`; fix any failures (requires Node 18.12+ and `pnpm install` for zod).
- [x] 9.2 Update README or examples: document params declaration, --params-file, template syntax, js file step.
