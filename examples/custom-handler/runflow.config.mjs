/**
 * Runflow config: register custom step handlers.
 * Paths are relative to this config file.
 *
 * Run from this directory: flow run flow.yaml
 * Or: flow run flow.yaml --config examples/custom-handler/runflow.config.mjs
 */
export default {
  handlers: {
    echo: './echo-handler.mjs',
  },
}
