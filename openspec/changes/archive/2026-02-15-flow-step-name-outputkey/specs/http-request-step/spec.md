# http-request-step (delta)

## MODIFIED Requirements

### Requirement: Http step output key SHALL be configurable (outputKey)

The key under which the http response is written to context SHALL be determined by the **executor** using the step's engine-reserved field `outputKey` (see step-context): when `outputKey` is present and a non-empty string, that value is the key; when absent, the step's `id` SHALL be used. The **http handler** SHALL return the response object (statusCode, headers, body) as `StepResult.outputs` without applying any key—i.e. the handler SHALL NOT wrap the response under a key in outputs; the executor SHALL write `outputs` to `context[effectiveKey]` where effectiveKey is `step.outputKey ?? step.id`.

#### Scenario: Default output key is step id

- **WHEN** an http step has `id: 'fetchUsers'` and no `outputKey` field
- **THEN** the handler returns StepResult with `outputs` equal to the response object `{ statusCode, headers, body }`
- **AND** the executor merges into context as `context.fetchUsers = { statusCode, headers, body }`
- **AND** the next step can reference `params.fetchUsers.body` or `{{ fetchUsers.statusCode }}`

#### Scenario: Explicit output key

- **WHEN** an http step has `id: 'fetchUsers'` and `outputKey: 'apiResult'`
- **THEN** the handler returns StepResult with `outputs` equal to the response object (no key wrapper)
- **AND** the executor merges into context as `context.apiResult = { statusCode, headers, body }`
- **AND** the next step can reference `params.apiResult` or `{{ apiResult.statusCode }}`

#### Scenario: Multiple http steps do not overwrite each other when output keys differ

- **WHEN** step 1 has `id: 'a', outputKey: 'first'` and step 2 has `id: 'b', outputKey: 'second'`
- **THEN** the executor writes the first step's outputs to `context.first` and the second's to `context.second`
- **AND** neither overwrites the other
