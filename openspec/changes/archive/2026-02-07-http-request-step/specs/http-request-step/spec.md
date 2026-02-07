# http-request-step Specification

## Purpose

定義 flow 支援步驟型別 `http`：以宣告式欄位（url、method、headers、body）發送 HTTP 請求；所有字串欄位支援與現有 context 一致的模板替換；回應可透過可配置的 output key 寫入 context；並支援 `allowErrorStatus` 以在非 2xx 時仍將 response 寫入 context 供後續步驟使用。

## Requirements

### Requirement: Flows MUST support steps with type `http`

A flow step MUST be allowed to have `type: 'http'` with a required `url` (string). The engine MUST send an HTTP request using the given url and optional method, headers, and body, and produce a `StepResult` with success/failure and optional `outputs` merged into context.

#### Scenario: Valid http step with 2xx response

- **WHEN** a flow contains a step `{ id: 'fetch', type: 'http', url: 'https://api.example.com/ok' }` and the response status is 2xx
- **THEN** the executor sends the request and marks the step as successful
- **AND** the step's `StepResult` has `success: true`
- **AND** the step's result includes `outputs` with the response (e.g. statusCode, headers, body) under the output key (step id or configured `output`)

#### Scenario: Http step with non-2xx and allowErrorStatus false (default)

- **WHEN** an http step receives a 4xx or 5xx response and `allowErrorStatus` is not set or is false
- **THEN** the executor marks the step as failed
- **AND** the step's `StepResult` has `success: false` and `error` set
- **AND** the step's outputs are NOT merged into context (or only error info; implementation may omit outputs)

#### Scenario: Http step with non-2xx and allowErrorStatus true

- **WHEN** an http step has `allowErrorStatus: true` and receives a 4xx or 5xx response
- **THEN** the executor SHALL still write the response (statusCode, headers, body) into context under the output key
- **AND** the step's `StepResult` has `success: false` (so the run can reflect that an error status occurred)
- **AND** subsequent steps SHALL see the response in context (e.g. `params.<outputKey>.statusCode`) and may branch on it

#### Scenario: Parser accepts and validates http steps

- **WHEN** YAML contains a step with `type: http` and a string `url` field
- **THEN** the parser includes a `FlowStepHttp` in the flow steps
- **AND** if `type` is `http` but `url` is missing or not a string, the parser returns null (invalid flow)
- **AND** optional fields method, headers, body, output, allowErrorStatus are parsed when present

#### Scenario: Flow can mix command, js, and http steps

- **WHEN** a flow has steps of type `command`, `js`, and `http`
- **THEN** the executor runs each step in order
- **AND** http step outputs are merged into context with the same later-overwrites semantics as js step outputs
- **AND** the run result contains one StepResult per step in the same order

### Requirement: Http step input fields SHALL support template substitution

Before sending the request, the executor SHALL substitute `{{ path }}` placeholders in the http step's url, method, header values, and body using the current context. The substitution semantics SHALL match the existing substitute function (dot and bracket index, undefined/null → empty string, object/array → JSON.stringify).

#### Scenario: Url and body from context

- **WHEN** context has `baseUrl: 'https://api.example.com'` and `token: 'secret'`, and the http step has `url: '{{ baseUrl }}/users'` and `headers: { Authorization: 'Bearer {{ token }}' }`
- **THEN** the actual request uses url `https://api.example.com/users` and the given Authorization header value
- **AND** the request is sent with substituted values

#### Scenario: Body from previous step output

- **WHEN** a prior step produced `outputs: { payload: '{"name":"x"}' }` and the http step has `body: '{{ payload }}'`
- **THEN** the request body is the string value of `payload` from context

### Requirement: Http step output key SHALL be configurable (output key)

The key under which the response is written to context SHALL be determined by the optional step field `output` (string). When `output` is present, that value is the key. When `output` is absent, the step's `id` SHALL be used as the key.

#### Scenario: Default output key is step id

- **WHEN** an http step has `id: 'fetchUsers'` and no `output` field
- **THEN** the response object is merged into context as `context.fetchUsers = { statusCode, headers, body }` (or equivalent shape)
- **AND** the next step can reference `params.fetchUsers.body` or `{{ fetchUsers.statusCode }}`

#### Scenario: Explicit output key

- **WHEN** an http step has `id: 'fetchUsers'` and `output: 'apiResult'`
- **THEN** the response object is merged into context as `context.apiResult = { statusCode, headers, body }`
- **AND** the next step can reference `params.apiResult` or `{{ apiResult.statusCode }}`

#### Scenario: Multiple http steps do not overwrite each other when output keys differ

- **WHEN** step 1 has `id: 'a', output: 'first'` and step 2 has `id: 'b', output: 'second'`
- **THEN** context has both `first` and `second` with their respective response objects
- **AND** neither overwrites the other

### Requirement: Response body SHALL be parsed when Content-Type is JSON

When the response Content-Type indicates JSON (e.g. application/json), the implementation SHALL parse the body as JSON and expose it as an object in the response shape. Otherwise the body MAY be a string.

#### Scenario: JSON response body is parsed

- **WHEN** the HTTP response has Content-Type application/json and body `{"id":1,"name":"x"}`
- **THEN** the value in outputs under the response key has `body` as an object `{ id: 1, name: 'x' }`
- **AND** template substitution and js steps can use `params.<key>.body.id` or `{{ <key>.body.name }}`

### Requirement: Network or runtime errors SHALL fail the step

When the request fails (e.g. network error, DNS failure, invalid URL) or the implementation throws, the step SHALL be marked as failed (`success: false`) with `error` set. Outputs SHALL NOT be merged for that step unless the implementation defines otherwise for specific error cases.

#### Scenario: Request fails due to network error

- **WHEN** the http step's request fails (e.g. ECONNREFUSED)
- **THEN** the step's `StepResult` has `success: false` and `error` set to a string representation
- **AND** no outputs from this step are merged into context
