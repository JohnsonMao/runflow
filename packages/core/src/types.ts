import type { HandlerConfig } from './handler-factory'

export type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array'

/** Param shape without `name`; used for nested schema values and array items. */
export type ParamDeclarationWithoutName = Omit<ParamDeclaration, 'name'>

export interface ParamDeclaration {
  name: string
  type: ParamType
  required?: boolean
  default?: unknown
  enum?: unknown[]
  description?: string
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
  /** When present, this step is part of the DAG. Empty array = root; omitted or non-array = root (no deps), same as []. */
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
  /** When true, engine continues to next steps even if this step fails. Default false. */
  continueOnError?: boolean
  /** Display/documentation only: short label for UI (e.g. node title, lists). Not used by engine. */
  name?: string
  /** Display/documentation only: longer description for tooltips, detail views. Not used by engine. */
  description?: string
  [key: string]: unknown
}

/**
 * Run another flow (already resolved). Used by flow step handler. Returns RunResult.
 */
export type RunFlowFn = (
  flow: FlowDefinition,
  params: Record<string, unknown>,
) => Promise<RunResult>

/** Context passed to each step handler (params + previous outputs). */
export interface StepContext {
  params: Record<string, unknown>
  /** Provided by engine so handlers build StepResult with consistent shape. Always set by the engine. */
  stepResult: StepResultFn
  /** Provided by the engine so the flow step handler can run another flow. Optional when not in a flow-call context. */
  run?: RunFlowFn
  /** When present, flow step handler can look up child flow by id (e.g. step.flow) and call run(flow, params). */
  flowMap?: Record<string, FlowDefinition>
  /** Flow steps (provided by engine). Handlers that need the full DAG (e.g. loop for closure) can use this. */
  steps?: FlowStep[]
  /** AbortSignal for lifecycle management (timeout, abort). Provided by engine for factory-based handlers. */
  signal?: AbortSignal
}

export interface FlowDefinition {
  id?: string
  tags?: string[]
  name?: string
  description?: string
  params?: ParamDeclaration[]
  steps: FlowStep[]
}

export interface StepResult {
  stepId: string
  /** The display name of the step, captured from FlowStep.name during execution. */
  name?: string
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
  nextSteps?: string[] | null
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
  name?: string
  error?: string
  outputs?: Record<string, unknown>
  log?: string
  nextSteps?: string[] | null
  completedStepIds?: string[]
  /** When present, executor flattens into main steps with stepId prefix `{parentStepId}.{childStepId}`. */
  subSteps?: StepResult[]
}

/** Signature of the stepResult factory, provided by executor on context so handlers use a single format. */
export type StepResultFn = (stepId: string, success: boolean, opts?: StepResultOptions) => StepResult

/** Registry: step type -> HandlerConfig. Merged with default (default first, then options.registry). */
export type StepRegistry = Record<string, HandlerConfig>

export interface RunOptions {
  dryRun?: boolean
  params?: Record<string, unknown>
  registry?: StepRegistry
  /**
   * When set, used for params validation and default application instead of flow.params.
   * Caller (e.g. CLI/MCP) merges config global params with flow.params (flow overrides same name) and passes here.
   */
  effectiveParamsDeclaration?: ParamDeclaration[]
  /** Max nesting depth for flow steps (default from DEFAULT_MAX_FLOW_CALL_DEPTH). When a flow step would run at this depth, it fails. */
  maxFlowCallDepth?: number
  /** Current flow-call depth (internal). 0 at top-level; incremented when run is invoked from context.run. */
  flowCallDepth?: number
  /** Map flow id (e.g. step.flow string) to FlowDefinition for nested flow steps. When a flow step runs, engine looks up options.flowMap[step.flow]. */
  flowMap?: Record<string, FlowDefinition>
  /** Default step timeout in seconds when step.timeout is not set. Falls back to engine default (60) when omitted. */
  defaultStepTimeoutSec?: number
  /** When true, engine continues execution even if a step fails (unless that step overrides with continueOnError: false). Default false. */
  continueOnError?: boolean
  /** Called just before a step runs (after substitute, validate, skip). */
  onStepStart?: (stepId: string, step: FlowStep) => void
  /** Called when a step completes (success or failure). */
  onStepComplete?: (stepId: string, result: StepResult) => void
}

export interface RunResult {
  success: boolean
  steps: StepResult[]
  error?: string
  /**
   * When the flow finishes or is interrupted, these are the nextSteps returned by steps
   * that do not target any step within the current FlowDefinition.
   */
  unconsumedNextSteps?: string[]
  /**
   * When set, indicates that the flow terminated early and this signal should be propagated.
   * Typically set to `null` to signal immediate termination of the parent flow.
   */
  nextSteps?: string[] | null
  /** Final context after the last step (for loop to pass to next iteration). */
  finalParams?: Record<string, unknown>
}
