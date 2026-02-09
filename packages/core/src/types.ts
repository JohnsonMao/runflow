export type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export interface ParamDeclaration {
  name: string
  type: ParamType
  required?: boolean
  default?: unknown
  enum?: unknown[]
  description?: string
  schema?: Record<string, ParamDeclaration>
  items?: ParamDeclaration
}

/** Generic step shape: id and type required, rest preserved for the handler. */
export interface FlowStep {
  id: string
  type: string
  /** When present, this step is part of the DAG. Empty array = root; omitted = orphan (not executed). */
  dependsOn?: string[]
  /** Skip this step when expression evaluates to false (engine). Expression runs with `params` in scope. */
  when?: string
  /** Max execution time in seconds. Enforced by engine; handlers (command, http, js) may use it to abort the operation. */
  timeout?: number
  /** Number of retries on failure (engine). Total attempts = retry + 1. */
  retry?: number
  [key: string]: unknown
}

/**
 * Run a sub-flow over a set of step ids (body) with the same executor model (DAG order,
 * when/condition/nextSteps). When any step returns nextSteps that include an id outside
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
}>

/** Run another flow by path; used by flow step handler. Returns RunResult (validation/load/run failures yield success: false + error). */
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
  /** When set, command step only allows these executable names (e.g. ['node','npx']). First token of run is checked (basename). */
  allowedCommands?: string[]
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
  stdout: string
  stderr: string
  error?: string
  outputs?: Record<string, unknown>
  /**
   * When set, only these step ids (among steps that depend on this step) are scheduled next.
   * When omitted, all dependents are scheduled (default). Handlers that control branching (e.g. condition)
   * return nextSteps so the executor does not need to know step types.
   */
  nextSteps?: string[]
}

/** Options for building a StepResult (e.g. via context.stepResult). */
export interface StepResultOptions {
  stdout?: string
  stderr?: string
  error?: string
  outputs?: Record<string, unknown>
  nextSteps?: string[]
}

/** Signature of the stepResult factory, provided by executor on context so handlers use a single format. */
export type StepResultFn = (stepId: string, success: boolean, opts?: StepResultOptions) => StepResult

/** Interface for step handlers. Implement via class. */
export interface IStepHandler {
  /** Execute the step. */
  run: (step: FlowStep, context: StepContext) => Promise<StepResult>
  /** When present, called by the engine on step timeout to force-abort the running operation (e.g. kill child process). */
  kill?: () => void
  /** Return true if step shape is valid, or a string error message. */
  validate?: (step: FlowStep) => true | string
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
  /** When set, command steps only allow these executable names (e.g. ['node','npx','echo']). Passed to step context for command handler. */
  allowedCommands?: string[]
}

export interface RunResult {
  flowName: string
  success: boolean
  steps: StepResult[]
  error?: string
}
