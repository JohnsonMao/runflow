# Runflow examples

Representative examples (converged set). Each demonstrates one main capability.

| File / directory | Description |
|------------------|-------------|
| `hello-flow.yaml` | Minimal flow: set steps. |
| `params-flow.yaml` | Parameters and step outputs (no schema). |
| `params-schema-flow.yaml` | Top-level params declaration and template substitution. Use `-f params.json` or `--param who=World`. |
| `dag-linear-flow.yaml` | Linear DAG: steps run in sequence. |
| `dag-parallel-flow.yaml` | Parallel DAG: independent steps in the same wave. |
| `http-flow.yaml` | HTTP step: request and response. |
| `js-file-flow.yaml` | Set steps with template substitution (renamed from js-file example). |
| `custom-handler/` | Custom step type via `runflow.config.mjs` and handler module; run with `--config` from this dir. |

Helper files: `params.json` is used by `params-schema-flow.yaml`.

**Removed (converged):** `condition-flow.yaml`, `mixed-flow.yaml`, `new-steps-flow.yaml` — condition steps are documented in the main README; mixed and new-steps overlapped with the above.
