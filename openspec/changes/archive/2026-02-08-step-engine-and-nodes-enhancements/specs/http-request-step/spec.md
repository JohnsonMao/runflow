# http-request-step (delta)

## Purpose

Add timeout, retry; change success and output semantics to always return responseObject and treat success as "request completed without network/runtime error"; define image/binary body as base64.

## MODIFIED Requirements

### Requirement: Http step success and outputs SHALL reflect request completion

A flow step with `type: 'http'` SHALL be executed via the registered http handler. The handler SHALL send the HTTP request and SHALL always set step outputs (under the configured output key) to a response object `{ statusCode, headers, body }` whenever the request completes (response received), regardless of status code. The step SHALL have `success: true` when the request completes without network or runtime error (i.e. no throw); any HTTP status code (2xx, 4xx, 5xx) SHALL result in success: true and outputs containing the response. The step SHALL have `success: false` only when the request fails (e.g. network error, timeout, DNS failure) or the handler throws; in that case the handler MAY still omit or partially set outputs. Parser SHALL accept steps with type http as generic steps; validation of url and other fields is the handler's responsibility.

#### Scenario: Valid http step with 2xx response

- **WHEN** a flow contains a step `{ id: 'fetch', type: 'http', url: 'https://api.example.com/ok' }` and the response status is 2xx
- **THEN** the handler sends the request and returns StepResult with success: true
- **AND** the step's result includes outputs with the response (statusCode, headers, body) under the output key

#### Scenario: Http step with 4xx or 5xx still succeeds and returns responseObject

- **WHEN** an http step receives a 4xx or 5xx response
- **THEN** the handler marks the step as success: true (request completed)
- **AND** the step's result includes outputs with the response object (statusCode, headers, body) under the output key
- **AND** the response object is merged into context so downstream steps can inspect statusCode or body

#### Scenario: Http step fails on network or runtime error

- **WHEN** the http step's request fails (e.g. ECONNREFUSED, timeout, invalid URL)
- **THEN** the step's StepResult has success: false and error set to a string representation
- **AND** outputs are NOT merged into context (or are omitted)

### Requirement: Response body SHALL be parsed or represented for JSON, text, and binary

When the response Content-Type indicates JSON (e.g. application/json), the http handler SHALL parse the body as JSON and expose it as an object in the response shape. When Content-Type indicates text, the body MAY be a string. When Content-Type indicates image (e.g. image/*) or application/octet-stream (or other binary), the handler SHALL read the response body as bytes and SHALL expose it in the response shape as a base64-encoded string so that the value is serializable in context (e.g. for template or downstream steps).

#### Scenario: JSON response body is parsed

- **WHEN** the HTTP response has Content-Type application/json and body `{"id":1,"name":"x"}`
- **THEN** the value in outputs under the response key has body as an object `{ id: 1, name: 'x' }`

#### Scenario: Image response body is base64

- **WHEN** the HTTP response has Content-Type image/png (or image/*) and a binary body
- **THEN** the handler SHALL read the body (e.g. arrayBuffer), encode as base64, and set response.body to that string
- **AND** downstream steps can use the string (e.g. for logging or passing to another API) without binary in JSON context

## ADDED Requirements

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
