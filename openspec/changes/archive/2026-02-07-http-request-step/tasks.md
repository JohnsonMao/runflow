# Tasks

## 1. Types

- [x] 1.1 In `packages/core/src/types.ts`: add `FlowStepHttp` (id, type: 'http', url, method?, headers?, body?, output?, allowErrorStatus?). Add to `FlowStep` union.

## 2. Parser

- [x] 2.1 In `packages/core/src/parser.ts`: for steps with `type: 'http'`, require `url` (string); accept optional method (string), headers (Record<string, string>), body (string), output (string), allowErrorStatus (boolean). Return FlowStepHttp or null when url missing/invalid.
- [x] 2.2 Add parser tests: valid http step, missing url, optional fields, invalid type.

## 3. Executor: runHttpStep and substitution

- [x] 3.1 Implement `runHttpStep(stepId, url, method, headers, body, outputKey, allowErrorStatus, context)`: substitute url, method, header values, body with `substitute(..., context)`; call fetch; build response object `{ statusCode, headers, body }`; parse body as JSON when Content-Type is application/json, else text.
- [x] 3.2 On 2xx: set success true, outputs `{ [outputKey]: responseObject }`. On non-2xx: if allowErrorStatus true, still set outputs and merge, set success false; else success false, no outputs.
- [x] 3.3 On network/runtime error: success false, error message, no outputs.
- [x] 3.4 In main run loop: when `step.type === 'http'`, compute outputKey = step.output ?? step.id; call runHttpStep; push result; merge result.outputs into context when present; update success.

## 4. Constants

- [x] 4.1 In `packages/core/src/constants.ts` (or equivalent): add `STEP_TYPE_HTTP = 'http'` if step type constants are centralized.

## 5. Tests

- [x] 5.1 Unit: runHttpStep with 2xx → success true, outputs under outputKey, body parsed when JSON.
- [x] 5.2 Unit: runHttpStep with 4xx/5xx, allowErrorStatus false → success false, no outputs.
- [x] 5.3 Unit: runHttpStep with 4xx/5xx, allowErrorStatus true → success false, outputs merged with response.
- [x] 5.4 Unit: substitution applied to url, method, headers, body before request.
- [x] 5.5 Unit: output key = step.id when output omitted; output key = step.output when provided.
- [x] 5.6 Integration: flow with command + http + js; http response visible in next step context (params / template).
- [x] 5.7 Parser: http step valid and invalid cases.

## 6. Main spec sync

- [x] 6.1 Copy or link `openspec/changes/http-request-step/specs/http-request-step/spec.md` into `openspec/specs/http-request-step/spec.md` when change is archived (or as part of apply/verify).

## 7. Verify and docs

- [x] 7.1 Run `pnpm test` and `pnpm run check`; fix any failures.
- [x] 7.2 Add example flow YAML (e.g. `examples/http-flow.yaml`) demonstrating http step with url, optional output and allowErrorStatus; update README if needed.
