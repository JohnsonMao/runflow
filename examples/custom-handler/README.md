# Custom handler example

This example shows how to register a custom step type via **config** and use it in a flow. The CLI builds the registry from built-in handlers (`@runflow/handlers`) and then merges your config handlers, so you only need to declare your custom type and path in `runflow.config.mjs`.

## Files

- **runflow.config.mjs** – Lists handler type names and paths to ESM modules (relative to config).
- **echo-handler.mjs** – Implements `IStepHandler`: `run(step, context)`, `validate(step)`, and `kill()`.
- **flow.yaml** – Flow that uses built-in `set` and custom `echo` steps.

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
- **`validate(step)`** – return `true` or a string error message.
- **`kill()`** – no-op if nothing to abort; otherwise abort any in-flight work (e.g. child process).

Example (object form):

```js
// my-handler.mjs
export default {
  validate(step) {
    return step.payload != null ? true : 'payload required'
  },
  kill() {},
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
