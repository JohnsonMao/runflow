# Custom step handler example

This directory contains the source for a custom step type (`echo`). It is registered in **examples/config/runflow.config.json** and used by the flow **examples/flows/basic/echo-demo.yaml**.

## Files

- **echo-handler.mjs** – Implements `IStepHandler` (`validate`, `kill`, `run`); writes `step.message` into context.

## Run the echo flow

From the repo root, using the single examples config:

```bash
pnpm run build
node apps/cli/dist/cli.js run basic/echo-demo.yaml --config examples/config/runflow.config.json --verbose
```

## Handler contract

- **validate(step)** – Return `true` or an error string; the engine calls this before running the step.
- **kill()** – Optional cleanup (e.g. terminate a child process); this example is a no-op.
- **run(step, context)** – Return `Promise<StepResult>`; use `context.stepResult(stepId, success, { outputs, log, error })` to build the result.

See `openspec/specs/custom-node-registry/spec.md` for the full spec.
