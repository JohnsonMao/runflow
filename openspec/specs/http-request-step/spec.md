# http-request-step Specification

## Purpose

定義 flow 支援步驟型別 `http`：以宣告式欄位（url、method、headers、body）發送 HTTP 請求；所有字串欄位支援與現有 context 一致的模板替換；回應可透過可配置的 output key（YAML 欄位 `output-key`）寫入 context。僅 2xx 時寫入 outputs；非 2xx 時步驟失敗、不寫入 context。

## Requirements

### Requirement: Flows MUST support steps with type `http`

A flow step MUST be allowed to have `type: 'http'` with a required `url` (string). The engine MUST execute this step via the **registered handler for `http`**. The handler MUST send an HTTP request using the given url and optional method, headers, and body, and produce a `StepResult` with success/failure and optional `outputs` merged into context. Parser SHALL accept any step with `id` and `type: 'http'` as a generic step (id + type + remaining keys); validation of `url` and other fields is the responsibility of the http handler or optional schema—parser SHALL NOT return null solely because `url` is missing for type `http` (invalid steps may be rejected at run time by the handler).

#### Scenario: Valid http step with 2xx response

- **WHEN** a flow contains a step `{ id: 'fetch', type: 'http', url: 'https://api.example.com/ok' }` and the default (or provided) registry includes the http handler, and the response status is 2xx
- **THEN** the executor invokes the http handler; the handler sends the request and returns a StepResult with `success: true`
- **AND** the step's result includes `outputs` with the response (e.g. statusCode, headers, body) under the output key (step id or configured `output-key` → `outputKey`)

#### Scenario: Http step with non-2xx: failed, no outputs

- **WHEN** an http step receives a 4xx or 5xx response
- **THEN** the handler marks the step as failed
- **AND** the step's `StepResult` has `success: false` and `error` set
- **AND** the step's outputs are NOT merged into context

#### Scenario: Parser accepts steps with type http as generic step

- **WHEN** YAML contains a step with `type: http` and optional `url`, `method`, `headers`, `body`, `output-key`
- **THEN** the parser SHALL include a generic FlowStep (id, type, and remaining keys) in the flow steps
- **AND** type-specific validation (e.g. url required) is NOT required at parse time; the built-in http handler SHALL enforce input contract at run time and MAY produce an error StepResult for invalid step shape

#### Scenario: Flow can mix command, js, and http steps

- **WHEN** a flow has steps of type `command`, `js`, and `http`
- **THEN** the executor runs each step in order via the registry
- **AND** http step outputs are merged into context with the same later-overwrites semantics as js step outputs
- **AND** the run result contains one StepResult per step in the same order

### Requirement: Http step input fields SHALL support template substitution

Before the http handler is invoked, the executor SHALL substitute `{{ path }}` placeholders in the step's url, method, header values, and body using the current context (per custom-node-registry: substitution is applied by executor before calling handler). The substitution semantics SHALL match the existing substitute function.

#### Scenario: Url and body from context

- **WHEN** context has `baseUrl: 'https://api.example.com'` and `token: 'secret'`, and the http step has `url: '{{ baseUrl }}/users'` and `headers: { Authorization: 'Bearer {{ token }}' }`
- **THEN** the executor passes the step to the handler with substituted values; the actual request uses url `https://api.example.com/users` and the given Authorization header value

#### Scenario: Body from previous step output

- **WHEN** a prior step produced `outputs: { payload: '{"name":"x"}' }` and the http step has `body: '{{ payload }}'`
- **THEN** the request body is the string value of `payload` from context (after substitution)

### Requirement: Http step output key SHALL be configurable (output-key)

The key under which the response is written to context SHALL be determined by the optional step field `output-key` in YAML (parsed as `outputKey`). When `outputKey` is present, that value is the key. When absent, the step's `id` SHALL be used as the key.

#### Scenario: Default output key is step id

- **WHEN** an http step has `id: 'fetchUsers'` and no `output-key` field
- **THEN** the response object is merged into context as `context.fetchUsers = { statusCode, headers, body }` (or equivalent shape)
- **AND** the next step can reference `params.fetchUsers.body` or `{{ fetchUsers.statusCode }}`

#### Scenario: Explicit output key

- **WHEN** an http step has `id: 'fetchUsers'` and `output-key: 'apiResult'` (parsed as outputKey)
- **THEN** the response object is merged into context as `context.apiResult = { statusCode, headers, body }`
- **AND** the next step can reference `params.apiResult` or `{{ apiResult.statusCode }}`

#### Scenario: Multiple http steps do not overwrite each other when output keys differ

- **WHEN** step 1 has `id: 'a', output-key: 'first'` and step 2 has `id: 'b', output-key: 'second'`
- **THEN** context has both `first` and `second` with their respective response objects
- **AND** neither overwrites the other

### Requirement: Response body SHALL be parsed when Content-Type is JSON

When the response Content-Type indicates JSON (e.g. application/json), the http handler SHALL parse the body as JSON and expose it as an object in the response shape. Otherwise the body MAY be a string.

#### Scenario: JSON response body is parsed

- **WHEN** the HTTP response has Content-Type application/json and body `{"id":1,"name":"x"}`
- **THEN** the value in outputs under the response key has `body` as an object `{ id: 1, name: 'x' }`
- **AND** template substitution and js steps can use `params.<key>.body.id` or `{{ <key>.body.name }}`

### Requirement: Network or runtime errors SHALL fail the step

When the request fails (e.g. network error, DNS failure, invalid URL) or the handler throws, the step SHALL be marked as failed (`success: false`) with `error` set. Outputs SHALL NOT be merged for that step unless the implementation defines otherwise for specific error cases.

#### Scenario: Request fails due to network error

- **WHEN** the http step's request fails (e.g. ECONNREFUSED)
- **THEN** the step's `StepResult` has `success: false` and `error` set to a string representation
- **AND** no outputs from this step are merged into context
