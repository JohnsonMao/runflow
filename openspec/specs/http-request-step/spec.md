# http-request-step Specification

## Purpose

定義 flow 支援步驟型別 `http`：以宣告式欄位（url、method、headers、body）發送 HTTP 請求；所有字串欄位支援與現有 context 一致的模板替換；回應可透過可配置的 output key（YAML 欄位 `outputKey`）寫入 context。請求完成且無 network/runtime 錯誤時 success 為 true，並一律回傳 responseObject（statusCode, headers, body）；4xx/5xx 仍為 success 並寫入 outputs。支援 timeout、retry；binary 回應以 base64 字串表示。

## Requirements

### Requirement: Flows MUST support steps with type `http`

A flow step MUST be allowed to have `type: 'http'` with a required `url` (string). The engine MUST execute this step via the **registered handler for `http`**. The handler MUST send an HTTP request using the given url and optional method, headers, and body, and produce a `StepResult` with success/failure and optional `outputs` merged into context. Parser SHALL accept any step with `id` and `type: 'http'` as a generic step (id + type + remaining keys); validation of `url` and other fields is the responsibility of the http handler or optional schema—parser SHALL NOT return null solely because `url` is missing for type `http` (invalid steps may be rejected at run time by the handler).

#### Scenario: Valid http step with 2xx response

- **WHEN** a flow contains a step `{ id: 'fetch', type: 'http', url: 'https://api.example.com/ok' }` and the default (or provided) registry includes the http handler, and the response status is 2xx
- **THEN** the executor invokes the http handler; the handler sends the request and returns a StepResult with `success: true`
- **AND** the step's result includes `outputs` with the response (e.g. statusCode, headers, body) under the output key (step id or configured `outputKey`)

#### Scenario: Http step with 4xx or 5xx still succeeds and returns responseObject

- **WHEN** an http step receives a 4xx or 5xx response
- **THEN** the handler marks the step as success: true (request completed)
- **AND** the step's result includes outputs with the response object (statusCode, headers, body) under the output key
- **AND** the response object is merged into context so downstream steps can inspect statusCode or body

#### Scenario: Parser accepts steps with type http as generic step

- **WHEN** YAML contains a step with `type: http` and optional `url`, `method`, `headers`, `body`, `outputKey`
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

### Requirement: Response body SHALL be parsed or represented for JSON, text, and binary

When the response Content-Type indicates JSON (e.g. application/json), the http handler SHALL parse the body as JSON and expose it as an object in the response shape. When Content-Type indicates text, the body MAY be a string. When Content-Type indicates image (e.g. image/*) or application/octet-stream (or other binary), the handler SHALL read the response body as bytes and SHALL expose it in the response shape as a base64-encoded string so that the value is serializable in context (e.g. for template or downstream steps).

#### Scenario: JSON response body is parsed

- **WHEN** the HTTP response has Content-Type application/json and body `{"id":1,"name":"x"}`
- **THEN** the value in outputs under the response key has `body` as an object `{ id: 1, name: 'x' }`
- **AND** template substitution and js steps can use `params.<key>.body.id` or `{{ <key>.body.name }}`

#### Scenario: Image response body is base64

- **WHEN** the HTTP response has Content-Type image/png (or image/*) and a binary body
- **THEN** the handler SHALL read the body (e.g. arrayBuffer), encode as base64, and set response.body to that string
- **AND** downstream steps can use the string (e.g. for logging or passing to another API) without binary in JSON context

### Requirement: Network or runtime errors SHALL fail the step

When the request fails (e.g. network error, DNS failure, invalid URL, timeout) or the handler throws, the step SHALL be marked as failed (`success: false`) with `error` set. Outputs SHALL NOT be merged for that step unless the implementation defines otherwise for specific error cases.

#### Scenario: Request fails due to network error

- **WHEN** the http step's request fails (e.g. ECONNREFUSED)
- **THEN** the step's `StepResult` has `success: false` and `error` set to a string representation
- **AND** no outputs from this step are merged into context

### Requirement: Http step MAY declare timeout and retry

An http step MAY include optional `timeout` (number, in seconds) and `retry` (number, default 1). When `timeout` is present and positive, the handler SHALL abort the request after that many seconds (e.g. using AbortController/signal); if the request times out, the handler SHALL treat it as a failure (success: false, no outputs merged). When `retry` is present, the handler SHALL attempt the request up to `(retry + 1)` times; retries SHALL occur only on failure (network/runtime error or timeout), not on receipt of 4xx/5xx. After all attempts, the handler SHALL return the last result (success with responseObject if any attempt received a response, or failure if all attempts failed).

#### Scenario: Request with timeout completes in time

- **WHEN** an http step has `timeout: 5` and the server responds within 5 seconds
- **THEN** the handler returns success with the response object as usual

#### Scenario: Request times out

- **WHEN** an http step has `timeout: 1` and the server does not respond within 1 second
- **THEN** the handler returns success: false and error indicating timeout; no outputs merged

#### Scenario: Request fails then succeeds on retry

- **WHEN** an http step has `retry: 1`; the first attempt fails (e.g. network error), the second attempt receives 200
- **THEN** the handler returns success: true with the response object from the second attempt
- **AND** outputs are merged into context

#### Scenario: All retry attempts fail

- **WHEN** an http step has `retry: 2` and all three attempts fail (e.g. network error)
- **THEN** the handler returns success: false and the last error; no outputs merged
