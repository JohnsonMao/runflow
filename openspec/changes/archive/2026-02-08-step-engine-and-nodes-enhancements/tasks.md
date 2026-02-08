## 1. Engine: when, timeout, retry

- [x] 1.1 Implement evaluateWhen(step, context) in executor using runInNewContext; skip step and push success result when false
- [x] 1.2 Implement runWithTimeout(step, runFn) in executor; timeout in seconds, Promise.race, reject with timeout error
- [x] 1.3 Implement retry loop in executor: (step.retry ?? 0) + 1 attempts, break on success, push last result on final failure
- [x] 1.4 Wire when check before handler run; wire timeout around each attempt; wire retry around runWithTimeout

## 2. Command handler enhancements

- [x] 2.1 Add optional timeout (seconds): use exec with timeout when step.timeout set; else keep execSync
- [x] 2.2 Add optional cwd: pass to exec/execSync options; support template substitution on cwd string
- [x] 2.3 Add optional env: merge with process.env; apply substitution to env values before run
- [x] 2.4 Add tests for command timeout, cwd, env (and substitution)

## 3. HTTP handler enhancements

- [x] 3.1 Add timeout (seconds): AbortController + setTimeout, pass signal to fetch
- [x] 3.2 Add retry (default 1): loop (retry + 1) attempts; retry only on throw; return last result
- [x] 3.3 Always return responseObject in outputs for any received response; success = true when no throw
- [x] 3.4 For Content-Type image/* or application/octet-stream: body as base64 string (arrayBuffer → Buffer.toString('base64'))
- [x] 3.5 Add tests for HTTP timeout, retry, 4xx/5xx success+outputs, image body base64

## 4. JS handler enhancements

- [x] 4.1 Add configurable timeout (step.timeout ms; default 10000) to runInNewContext options
- [x] 4.2 Add output-key: when return is plain object, keep current merge; when non-object, set outputs[outputKey] = value
- [x] 4.3 Support async: wrap code in async IIFE, pass Promise in VM context, await result; apply same output rules to resolved value
- [x] 4.4 Add tests for JS timeout, output-key (object and primitive), async return and rejection

## 5. New handler: sleep

- [x] 5.1 Create handlers/sleep.ts: type sleep, required seconds or ms (after substitution), setTimeout then success no outputs
- [x] 5.2 Register sleep in default registry
- [x] 5.3 Add tests for sleep seconds, ms, template substitution, missing duration error

## 6. New handler: set

- [x] 6.1 Create handlers/set.ts: type set, required set (object); return outputs = step.set (already substituted by executor)
- [x] 6.2 Register set in default registry
- [x] 6.3 Add tests for set literal, template in set values, downstream sees set keys

## 7. Loop step (executor-driven body/done, early exit) — spec updated, implementation complete

- [x] 7.1 Executor: add sub-run capability: given a set of step ids (body), run them with same model (DAG, when/condition/nextSteps); return when complete or when nextSteps reference a step outside the set (early exit signal; return that nextSteps)
- [x] 7.2 Loop step: exactly one of items | count | until; required body (step ids), optional done (step ids). For each iteration: run body via executor sub-run. On **normal** exit: complete loop step with nextSteps: done. On **early** exit (body step returned nextSteps outside body): complete loop step with that nextSteps; **do not run done**
- [x] 7.3 Validate loop: exactly one of items/count/until; body required and non-empty; body/done ids must exist in flow
- [x] 7.4 Register loop in default registry (if not already); ensure loop handler delegates body execution to executor, not fixed runSubSteps(ids) order
- [x] 7.5 Add tests: loop with items + body DAG order, normal completion returns nextSteps: done; until exit then nextSteps: done; early exit returns body’s nextSteps and does not run done; invalid driver (none or two of items/count/until)

## 8. Integration and examples

- [x] 8.1 Add example flows: sleep, set, loop (and optionally engine when/timeout/retry, http/js enhancements)
- [x] 8.2 Run full check (typecheck, lint, test) and fix any regressions
