export type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array'

/** Param shape without `name`; used for nested schema values and array items. */
export type ParamDeclarationWithoutName = Omit<ParamDeclaration, 'name'>

/** Param location for API flows (path, query, header, body). When set, discover may filter to path/query/body only. */
export type ParamIn = 'path' | 'query' | 'header' | 'cookie' | 'body'

export interface ParamDeclaration {
  name: string
  type: ParamType
  required?: boolean
  default?: unknown
  enum?: unknown[]
  description?: string
  /** For API flows: path, query, header, cookie, or body. Omitted for YAML flow params. */
  in?: ParamIn
  schema?: Record<string, ParamDeclarationWithoutName>
  items?: ParamDeclarationWithoutName
}

/**
 * Generic step shape: id and type required, rest preserved for the handler.
 *
 * Engine-reserved fields (id, type, dependsOn, skip, timeout, retry, outputKey) have fixed semantics.
 * Handler-specific fields (e.g. when, then, else for condition) are documented per handler.
 * Extending this interface with your own step types and overlapping the same keys is normal:
 * you narrow types (e.g. when: string) or add constraints; the index signature [key: string]: unknown
 * allows extra properties. Prefer not to reuse engine-reserved names for different semantics.
 */
export interface FlowStep {
  id: string
  type: string
  /** When present, this step is part of the DAG. Empty array = root; omitted = orphan (not executed). */
  dependsOn?: string[]
  /**
   * When expression evaluates to true, engine skips this step (default false).
   * Evaluated with params in scope. Skipped step gets success result and no nextSteps (dependents may all run).
   */
  skip?: string
  /** Max execution time in seconds. Enforced by engine; handlers (e.g. http) may use it to abort the operation. */
  timeout?: number
  /** Number of retries on failure (engine). Total attempts = retry + 1. */
  retry?: number
  /** Key under which the step's outputs are written to context. When absent, the executor uses step id. */
  outputKey?: string
  /** Display/documentation only: short label for UI (e.g. node title, lists). Not used by engine. */
  name?: string
  /** Display/documentation only: longer description for tooltips, detail views. Not used by engine. */
  description?: string
  [key: string]: unknown
}

/**
 * Run a sub-flow over a set of step ids (body) with the same executor model (DAG order,
 * skip/condition/nextSteps). When any step returns nextSteps that include an id outside
 * the set, returns earlyExit with that nextSteps so the caller (e.g. loop) can complete
 * with that branch.
 */
export type RunSubFlowFn = (
  bodyStepIds: string[],
  ctx: Record<string, unknown>,
) => Promise<{
  results: StepResult[]
  newContext: Record<string, unknown>
  earlyExit?: { nextSteps: string[] }
  /** Set when requested bodyStepIds include id(s) not in the flow; caller should fail the step. */
  error?: string
}>

/** Result of resolving a flowId to a runnable flow. Returned by optional RunOptions.resolveFlow. */
export interface ResolvedFlow {
  flow: FlowDefinition
  /** Optional path for the flow (file path or spec path); used as flowFilePath for nested run. */
  flowFilePath?: string
}

/** Resolver that turns a flowId (path or prefix-operation) into a flow. Used when provided in RunOptions. */
export type ResolveFlowFn = (flowId: string) => Promise<ResolvedFlow | null>

/** Run another flow by path or flowId; used by flow step handler. Returns RunResult (validation/load/run failures yield success: false + error). */
export type RunFlowFn = (
  filePath: string,
  params: Record<string, unknown>,
) => Promise<RunResult>

/** Context passed to each step handler (params + previous outputs, flowFilePath). */
export interface StepContext {
  params: Record<string, unknown>
  flowFilePath?: string
  /** Provided by executor so handlers (e.g. loop) can run body as sub-flow (DAG, early exit). */
  runSubFlow: RunSubFlowFn
  /** Provided by executor so handlers build StepResult with consistent shape. Always set by the engine. */
  stepResult: StepResultFn
  /** Provided by executor so flow step handler can run another flow (load + run with depth limit). Optional when not in a flow-call context. */
  runFlow?: RunFlowFn
  /** When set and non-empty, http step only allows these hostnames (case-insensitive). Omit or empty = allow all (including localhost/private IP). */
  allowedHttpHosts?: string[]
  /** Flow steps (provided by executor). Handlers that need the full DAG (e.g. loop for closure) can use this. */
  steps?: FlowStep[]
  /** When provided by executor, handler may call during run to append log lines; executor merges them with result.log when handler returns. */
  appendLog?: (message: string) => void
  /** When provided by executor, handler may push a marker step (stepId, optional log) to RunResult.steps for timeline display. */
  pushMarkerStep?: (stepId: string, log?: string) => void
}

export interface FlowDefinition {
  name: string
  description?: string
  params?: ParamDeclaration[]
  steps: FlowStep[]
}

export interface StepResult {
  stepId: string
  success: boolean
  error?: string
  outputs?: Record<string, unknown>
  /** Optional one-line summary for display (e.g. MCP execute, CLI --verbose). Handlers set this instead of stdout/stderr. */
  log?: string
  /**
   * When set, only these step ids (among steps that depend on this step) are scheduled next.
   * When omitted, all dependents are scheduled (default). Handlers that control branching (e.g. condition)
   * return nextSteps so the executor does not need to know step types.
   */
  nextSteps?: string[]
  /**
   * When set, these step ids are marked completed in the main flow (e.g. they were run inside this step's sub-flow).
   * Executor uses this so it does not run them again at top level. Handlers that run sub-flows (e.g. loop) return this.
   */
  completedStepIds?: string[]
  /** When present, executor flattens these into main steps with stepId prefix `{parentStepId}.{childStepId}`. */
  subSteps?: StepResult[]
}

/** Options for building a StepResult (e.g. via context.stepResult). */
export interface StepResultOptions {
  error?: string
  outputs?: Record<string, unknown>
  log?: string
  nextSteps?: string[]
  completedStepIds?: string[]
  /** When present, executor flattens into main steps with stepId prefix `{parentStepId}.{childStepId}`. */
  subSteps?: StepResult[]
}

/** Signature of the stepResult factory, provided by executor on context so handlers use a single format. */
export type StepResultFn = (stepId: string, success: boolean, opts?: StepResultOptions) => StepResult

/** Interface for step handlers. Implement via class. */
export interface IStepHandler {
  /** Execute the step. */
  run: (step: FlowStep, context: StepContext) => Promise<StepResult>
  /** Called by the engine on step timeout to force-abort (e.g. kill child process). Implement no-op if nothing to clean up. */
  kill: () => void
  /** Return true if step shape is valid, or a string error message. Enforced before run. */
  validate: (step: FlowStep) => true | string
  /**
   * When present, the engine calls this to get the set of step ids that may have dependsOn including this step.
   * Only those steps are allowed to depend on this step; any other step with dependsOn including this step causes validation to fail.
   * Omit to allow any step to depend on this one. Core does not interpret step shape; the handler owns this logic.
   */
  getAllowedDependentIds?: (step: FlowStep) => string[]
}

/** Registry: step type -> IStepHandler. Merged with default (default first, then options.registry). */
export type StepRegistry = Record<string, IStepHandler>

export interface RunOptions {
  dryRun?: boolean
  params?: Record<string, unknown>
  flowFilePath?: string
  registry?: StepRegistry
  /** Max nesting depth for flow steps (default from DEFAULT_MAX_FLOW_CALL_DEPTH). When a flow step would run at this depth, it fails. */
  maxFlowCallDepth?: number
  /** Current flow-call depth (internal). 0 at top-level; incremented when run is invoked from runFlow. */
  flowCallDepth?: number
  /** When set and non-empty, http steps only allow these hostnames (case-insensitive). Omit or empty = allow all. */
  allowedHttpHosts?: string[]
  /** When set, flow steps resolve the step's flow string via this resolver (flowId → flow); allows workspace-wide and OpenAPI flows. When absent, path is resolved relative to caller's directory and loadFromFile only. */
  resolveFlow?: ResolveFlowFn
}

export interface RunResult {
  flowName: string
  success: boolean
  steps: StepResult[]
  error?: string
}
