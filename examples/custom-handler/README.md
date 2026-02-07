# Custom handler example (registerStepHandler)

This example shows how to register a custom step type via **config** and use it in a flow.

## Files

- **runflow.config.mjs** – Lists handler type names and paths to ESM modules (relative to config).
- **echo-handler.mjs** – Implements `IStepHandler`: `run(step, context)` and optional `validate(step)`.
- **flow.yaml** – Flow that uses built-in `command` and custom `echo` steps.

## Run

From repo root (build first, then run with explicit config):

```bash
pnpm run build
node apps/cli/dist/cli.js run examples/custom-handler/flow.yaml --config examples/custom-handler/runflow.config.mjs
```

Add `--verbose` to print each step’s stdout/stderr.

From this directory (config is auto-discovered as `runflow.config.mjs` in cwd):

```bash
cd examples/custom-handler
node ../../apps/cli/dist/cli.js run flow.yaml
```

## Handler contract (IStepHandler)

Your module must **export default** an object (or class instance) with:

- **`run(step, context)`** – `async` function returning `Promise<StepResult>`.
- **`validate(step)`** – optional; return `true` or a string error message.

Example (class form):

```js
// my-handler.mjs
export default {
  validate(step) {
    return step.payload != null ? true : 'payload required'
  },
  async run(step, context) {
    return {
      stepId: step.id,
      success: true,
      stdout: '',
      stderr: '',
      outputs: { result: step.payload },
    }
  },
}
```

Then in `runflow.config.mjs`:

```js
export default {
  handlers: {
    myStep: './my-handler.mjs',
  },
}
```
