# flow-call-step (delta: inject-resolve-flow)

## MODIFIED Requirements

### Requirement: Flows SHALL support steps with type `flow` that run another flow

A flow step MAY have `type: 'flow'` and a required `flow` string (the **flowId**). The engine MUST execute this step via the **registered handler for `flow`**. Resolution of the callee flow SHALL behave as follows.

- **When run options provide an optional resolver** (e.g. `resolveFlow(flowId)`): The engine SHALL treat the step's `flow` string as a flowId and call that resolver. The resolver MAY resolve to a flow from a file (e.g. path relative to a configured workspace) or to an OpenAPI-derived flow (e.g. `prefix-operation`). The engine SHALL run the returned flow with the same resolver so nested flow steps remain workspace- and OpenAPI-aware. Path traversal and "under current flow directory" constraints do not apply; the runner is responsible for what the resolver returns.
- **When no resolver is provided**: The engine SHALL treat the step's `flow` string as a path to a callee flow file (relative or absolute). The handler SHALL resolve relative paths relative to the calling flow's directory (from `context.flowFilePath`); absolute paths SHALL be used as-is. The handler SHALL load the callee flow with the existing loader and run it with the existing executor. Path traversal (e.g. `..`) SHALL be rejected so the resolved path remains under the current flow's directory.

In both cases the callee flow SHALL receive params from the step's optional `params` field (or empty object when omitted).

#### Scenario: Valid flow step runs another flow successfully (no resolver)

- **WHEN** a flow contains a step `{ id: 'call1', type: 'flow', flow: 'sub.yaml', params: { x: 1 } }`, `context.flowFilePath` is `/dir/main.yaml`, no resolver is provided, and `/dir/sub.yaml` exists and defines a valid flow
- **THEN** the handler resolves path to `/dir/sub.yaml`, loads the flow, runs it with `params: { x: 1 }`
- **AND** the handler returns a StepResult with `success: true` and `outputs` merged from all callee step results

#### Scenario: Flow step with relative path resolves from caller directory (no resolver)

- **WHEN** no resolver is provided, `flowFilePath` is `/project/flows/main.yaml`, and the step has `flow: 'lib/helper.yaml'`
- **THEN** the handler resolves to `/project/flows/lib/helper.yaml` and loads that file
- **AND** if the file does not exist or fails to load, the handler returns StepResult with `success: false` and an error message

#### Scenario: Flow step with absolute path (no resolver)

- **WHEN** no resolver is provided and the step has `flow: '/absolute/path/to/flow.yaml'`
- **THEN** the handler uses that path directly for loading
- **AND** load failure yields StepResult with `success: false`

#### Scenario: Flow step with resolver resolves flowId to workspace file

- **WHEN** run options provide a resolver that resolves flowIds under a configured workspace, and the step has `flow: 'other-dir/helper.yaml'` (a path under the workspace but not under the caller's directory)
- **THEN** the engine calls the resolver with that flowId; the resolver returns the loaded flow (and optional flowFilePath)
- **AND** the engine runs that flow with the same resolver; the flow step returns success and merged outputs when the callee succeeds

#### Scenario: Flow step with resolver resolves flowId to OpenAPI flow

- **WHEN** run options provide a resolver that resolves OpenAPI flowIds (e.g. `prefix-operation`), and the step has `flow: 'simple-getPet'`
- **THEN** the engine calls the resolver with that flowId; the resolver returns the OpenAPI-derived flow (and optional flowFilePath, e.g. spec path)
- **AND** the engine runs that flow with the same resolver; the flow step returns success and merged outputs when the callee succeeds

#### Scenario: Resolver returns null yields flow not found

- **WHEN** a resolver is provided and the step's `flow` is a flowId that the resolver does not recognize or cannot load
- **THEN** the resolver returns null (or equivalent)
- **AND** the flow step returns StepResult with `success: false` and an error indicating the flow could not be loaded

#### Scenario: Parser accepts steps with type flow as generic step

- **WHEN** YAML contains a step with `type: flow` and a `flow` field
- **THEN** the parser SHALL include a generic FlowStep (id, type, and remaining keys) in the flow steps
- **AND** validation of required `flow` and optional `params` is the responsibility of the flow handler at run time
