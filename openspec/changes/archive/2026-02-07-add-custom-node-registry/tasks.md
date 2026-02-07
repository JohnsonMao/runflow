## 1. Types and exports

- [x] 1.1 Define `FlowStep` as generic shape `{ id: string; type: string; [key: string]: unknown }` in types.ts
- [x] 1.2 Define `StepContext` (params/previousOutputs, flowFilePath, flowName optional) in types.ts
- [x] 1.3 Define `StepHandler` type `(step: FlowStep, context: StepContext) => Promise<StepResult>` in types.ts
- [x] 1.4 Define `StepRegistry` as `Record<string, StepHandler>` (or type alias) in types.ts
- [x] 1.5 Add `registry?: StepRegistry` to `RunOptions` in types.ts
- [x] 1.6 Export StepHandler, StepContext, StepRegistry from core index

## 2. Parser

- [x] 2.1 Change parseStep to accept any step with `id` (string) and `type` (string); produce generic FlowStep with rest keys preserved
- [x] 2.2 Remove type-specific branches for command/js/http (no validation of run, url, file at parse time)
- [x] 2.3 Return null only when id or type missing or type not string
- [x] 2.4 Update parser tests for generic step shape and unknown types accepted; remove or adjust tests that assumed parse-time rejection for invalid js/http

## 3. Built-in handlers

- [x] 3.1 Add handlers/command.ts implementing StepHandler for type 'command' (logic from current runCommandStep)
- [x] 3.2 Add handlers/js.ts implementing StepHandler for type 'js' (logic from current runJsStep, use context.flowFilePath)
- [x] 3.3 Add handlers/http.ts implementing StepHandler for type 'http' (logic from current runHttpStep)
- [x] 3.4 Ensure each handler receives step after substitution (handlers use step fields as-is); document that executor does substitution before call

## 4. Registry and default registry

- [x] 4.1 Implement createDefaultRegistry() returning a StepRegistry with 'command', 'js', 'http' handlers
- [x] 4.2 Export createDefaultRegistry and (optional) registerStepHandler helper from core

## 5. Executor

- [x] 5.1 Resolve registry: use options.registry ?? createDefaultRegistry()
- [x] 5.2 For each step: apply substitute(step, context) to get substituted step snapshot (all string values)
- [x] 5.3 Look up handler by step.type; if missing, push error StepResult (success: false, error: "Unknown step type: ...") and continue
- [x] 5.4 If handler present: call in try/catch; on throw/reject, push StepResult(success: false, error: message); on resolve, push result and merge outputs into context
- [x] 5.5 Remove all if/else branches on step.type (command/http/js); single dispatch path via registry
- [x] 5.6 dryRun: unchanged (no handler calls)
- [x] 5.7 Update executor tests: use default registry; add tests for unknown type, handler throw, custom handler when registry passed

## 6. CLI

- [x] 6.1 Build registry for run(): if --config or cwd has runflow.config.mjs/js, use buildRegistryFromConfig (default + config.handlers); else createDefaultRegistry(); then if --registry &lt;path&gt;, load that ESM module’s default (StepRegistry) and merge into registry via registerStepHandler
- [x] 6.2 Support --registry &lt;path&gt; and config file handlers (runflow.config.mjs/js with handlers: { type: path }); add examples/custom-handler (echo handler + runflow.config.mjs + flow.yaml + README)

## 7. Verification

- [x] 7.1 Run full test suite (parser, executor, loader, substitute) and fix any failures
- [x] 7.2 Run typecheck and lint
