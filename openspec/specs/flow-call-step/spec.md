# flow-call-step Specification

## Purpose

定義 step type `flow`（call-flow）：在執行時載入並執行**另一個 flow 檔案**，傳入參數，並將被呼叫 flow 的 step outputs 合併為本 step 的 outputs，以達成 flow 重用與組合。

## Requirements

### Requirement: Flows SHALL support steps with type `flow` that run another flow file

A flow step MAY have `type: 'flow'` and a required `flow` string indicating the path to the callee flow file (relative or absolute). The engine MUST execute this step via the **registered handler for `flow`**. The handler SHALL resolve the path relative to the calling flow's directory (from `context.flowFilePath`) when the path is relative; when absolute, use as-is. The handler SHALL load the callee flow with the existing loader and run it with the existing executor; the callee flow SHALL receive params from the step's optional `params` field (or empty object when omitted).

#### Scenario: Valid flow step runs another flow successfully

- **WHEN** a flow contains a step `{ id: 'call1', type: 'flow', flow: 'sub.yaml', params: { x: 1 } }`, `context.flowFilePath` is `/dir/main.yaml`, and `/dir/sub.yaml` exists and defines a valid flow
- **THEN** the handler resolves path to `/dir/sub.yaml`, loads the flow, runs it with `params: { x: 1 }`
- **AND** the handler returns a StepResult with `success: true` and `outputs` merged from all callee step results

#### Scenario: Flow step with relative path resolves from caller directory

- **WHEN** `flowFilePath` is `/project/flows/main.yaml` and the step has `flow: 'lib/helper.yaml'`
- **THEN** the handler resolves to `/project/flows/lib/helper.yaml` and loads that file
- **AND** if the file does not exist or fails to load, the handler returns StepResult with `success: false` and an error message

#### Scenario: Flow step with absolute path

- **WHEN** the step has `flow: '/absolute/path/to/flow.yaml'`
- **THEN** the handler uses that path directly for loading
- **AND** load failure yields StepResult with `success: false`

#### Scenario: Parser accepts steps with type flow as generic step

- **WHEN** YAML contains a step with `type: flow` and a `flow` field
- **THEN** the parser SHALL include a generic FlowStep (id, type, and remaining keys) in the flow steps
- **AND** validation of required `flow` and optional `params` is the responsibility of the flow handler at run time

### Requirement: Flow step SHALL pass params to the callee flow

The flow step MAY include an optional `params` object. When present, the handler SHALL pass it as the `params` option to `run(loadedFlow, { params })`. When omitted, the handler SHALL pass an empty object. The caller's context (parent flow params or prior step outputs) SHALL NOT be automatically merged into callee params unless the step explicitly copies them into `params`; this keeps the callee contract explicit.

#### Scenario: Params passed to callee

- **WHEN** the flow step has `params: { a: 1, b: 'two' }` and the callee flow runs
- **THEN** the callee flow's steps receive context where `params.a === 1` and `params.b === 'two'`
- **AND** the callee flow does not see the parent flow's other context keys unless they are included in `params`

#### Scenario: No params key

- **WHEN** the flow step has no `params` field
- **THEN** the handler calls run with `params: {}`
- **AND** the callee flow runs with empty initial params

### Requirement: Flow step SHALL validate passed params against callee flow params declaration

When the callee flow defines a top-level `params` array (ParamDeclaration), the engine SHALL validate the step's passed `params` against that declaration before running the callee flow. The same validation as for top-level `run(flow, options)` SHALL apply (required params present, types match, enum and schema/items when declared). When validation fails, the flow step handler SHALL NOT run the callee and SHALL return a StepResult with `success: false` and `error` describing the validation failure (e.g. missing required, type mismatch, enum violation).

#### Scenario: Callee has params declaration and passed params are valid

- **WHEN** the callee flow declares `params: [{ name: 'a', type: 'string', required: true }]` and the flow step has `params: { a: 'x' }`
- **THEN** validation succeeds and the callee flow runs with those params
- **AND** the flow step returns success and outputs as usual

#### Scenario: Callee has params declaration and passed params fail validation

- **WHEN** the callee flow declares a required param or type and the flow step's `params` omit it or provide wrong type
- **THEN** validation fails before the callee flow runs
- **AND** the flow step returns StepResult with `success: false` and `error` indicating the validation cause (e.g. missing required param, type mismatch)

#### Scenario: Callee has no params declaration

- **WHEN** the callee flow omits the top-level `params` array
- **THEN** no params schema validation is performed; the passed params (or {}) are used as the callee's initial context
- **AND** the callee runs as with top-level run() without params declaration

### Requirement: Flow step SHALL merge callee step outputs into its StepResult.outputs

After the callee flow completes successfully, the handler SHALL collect all StepResult.outputs from the callee's executed steps and merge them into a single object with later-overwrites semantics (same as step-context). The flow step's StepResult SHALL set this merged object as `outputs`. Subsequent steps in the caller flow SHALL see these outputs in their context.

#### Scenario: Outputs merged from callee

- **WHEN** the callee flow has two steps that produce `outputs: { k: 'v1' }` and `outputs: { k: 'v2', x: 1 }` respectively
- **THEN** the flow step's StepResult has `outputs: { k: 'v2', x: 1 }`
- **AND** the next step in the caller flow receives context including `k` and `x` with those values

#### Scenario: Callee flow has no step outputs

- **WHEN** the callee flow runs but no step produces outputs
- **THEN** the flow step's StepResult has `outputs` set to `{}` or omitted
- **AND** the caller context is not updated with new keys from this step

### Requirement: Flow step sub-flow steps SHALL be flattened into main RunResult.steps

When a flow step runs a callee flow and obtains a RunResult, the executor SHALL push each of the callee's `result.steps` into the main flow's `steps` array, so that each callee step appears as a separate entry in the final RunResult. Each flattened step's `stepId` SHALL be prefixed to avoid collision with the main flow, in the form `{parentStepId}.{childStepId}` (e.g. `sub.sub-set`). The parent flow step's own StepResult (e.g. stepId `sub`) SHALL remain in the main steps; the callee steps SHALL be pushed immediately after it, in order.

#### Scenario: Sub-flow steps appear in main result with prefixed stepId

- **WHEN** the main flow has a step `id: 'sub', type: 'flow', flow: 'sub.yaml'` and the callee flow has steps `sub-set`, `other`
- **THEN** after the flow step runs, the main RunResult.steps SHALL contain an entry for `sub` (the flow step itself) followed by entries with stepId `sub.sub-set` and `sub.other`
- **AND** each of those entries SHALL retain their success, log, outputs, and error from the callee run so that MCP/CLI formatRunResult shows one line per step with log when present

#### Scenario: Flattened step preserves log and success

- **WHEN** the callee step `sub-set` returns StepResult with `log: 'set keys: fromSub, receivedFrom'` and `success: true`
- **THEN** the main RunResult.steps SHALL include an entry with stepId `sub.sub-set`, `log: 'set keys: fromSub, receivedFrom'`, and `success: true`
- **AND** the formatter (e.g. MCP execute) SHALL display that line like any other step (e.g. `- ✓ sub.sub-set` and `log: set keys: ...`)

#### Scenario: Order is flow step then callee steps

- **WHEN** the main flow runs steps `init`, `sub` (flow step), `next`
- **THEN** the final RunResult.steps order SHALL be: steps for `init`; then the step for `sub`; then steps for `sub.{childStepId}` for each callee step in order; then steps for any subsequent main steps such as `next`
- **AND** the same ordering semantics SHALL apply as for loop (body steps inserted after the loop step)

### Requirement: Flow step SHALL report failure when callee fails to load or run

When the loader returns null (file not found or parse error), or when the callee flow's run returns `success: false`, the flow step handler SHALL return a StepResult with `success: false` and SHALL include an `error` (or stderr) message indicating the cause (e.g. "flow not found", "callee flow failed").

#### Scenario: Callee file not found

- **WHEN** the resolved path does not exist or cannot be read
- **THEN** the handler returns StepResult with `success: false` and `error` describing that the flow could not be loaded
- **AND** no callee flow is executed

#### Scenario: Callee flow execution fails

- **WHEN** the callee flow runs and one of its steps fails (RunResult.success === false)
- **THEN** the flow step's StepResult has `success: false`
- **AND** the StepResult includes error information (e.g. from RunResult.error or the failing step)

### Requirement: Flow step SHALL support template substitution for flow and params

Before the handler runs, the executor SHALL apply template substitution to the step's `flow` string and to the `params` object (per template-substitution and custom-node-registry). The handler SHALL receive the step with `flow` and `params` already substituted so that paths and param values can depend on context.

#### Scenario: Flow path and params substituted from context

- **WHEN** context has `env: 'staging'`, `file: 'staging.yaml'` and the step has `flow: '{{ file }}'`, `params: { env: '{{ env }}' }`
- **THEN** the executor passes the step to the handler with `flow: 'staging.yaml'` and `params: { env: 'staging' }`
- **AND** the handler loads and runs the flow at the resolved path with those params

### Requirement: Flow step MAY declare timeout and retry

The flow step MAY include optional `timeout` (number, seconds) and `retry` (number) as with other steps. The executor SHALL enforce step-level timeout over the entire flow-call execution (load + run callee). Retry SHALL apply to the flow step as a whole (re-run load + run on failure).

#### Scenario: Flow step timeout covers full callee execution

- **WHEN** the flow step has `timeout: 5` and the callee flow runs longer than 5 seconds
- **THEN** the executor SHALL abort and the flow step returns StepResult with `success: false` and timeout error
- **AND** handler kill semantics apply if the handler implements kill (e.g. abort in-flight run)

### Requirement: Flow-call depth SHALL be bounded to prevent recursion

The engine SHALL enforce a maximum flow-call depth (default 32). Top-level flow has depth 0; each time a flow step runs a callee flow, the callee runs at depth (current depth + 1). When running a flow step would cause the callee to run at or above the maximum depth, the handler SHALL NOT execute the callee and SHALL return a StepResult with `success: false` and an `error` message indicating that the maximum flow-call depth was exceeded. The maximum depth MAY be overridden via run options (e.g. RunOptions.maxFlowCallDepth) for tests or CLI; when not provided, the default SHALL be used.

#### Scenario: Flow step at depth below limit runs normally

- **WHEN** the current flow is running at depth less than the maximum (e.g. depth 0 or 10) and a flow step is executed
- **THEN** the handler runs the callee flow at depth + 1
- **AND** the step returns success and outputs as specified for normal execution

#### Scenario: Flow step at depth limit returns depth-exceeded error

- **WHEN** the current flow is already at depth (maxDepth - 1) and a flow step is executed (so the callee would run at maxDepth)
- **THEN** the handler SHALL NOT load or run the callee flow
- **AND** the handler returns StepResult with `success: false` and `error` indicating maximum flow-call depth exceeded (or equivalent wording)

#### Scenario: Depth limit is configurable via run options

- **WHEN** the flow is run with options that set maxFlowCallDepth (e.g. 2) and a flow step at depth 1 tries to call another flow (callee would run at depth 2)
- **THEN** the handler SHALL reject the call (callee would run at depth 2, which equals the configured max) and return StepResult with success: false and error indicating depth exceeded
- **AND** when run with a larger max (e.g. maxFlowCallDepth: 64), nesting is allowed until the callee would run at depth 64, at which point the next flow step fails
