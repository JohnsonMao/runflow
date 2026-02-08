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
  [key: string]: unknown
}

/** Context passed to each step handler (params + previous outputs, flowFilePath). */
export interface StepContext {
  params: Record<string, unknown>
  flowFilePath?: string
  flowName?: string
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

/** Interface for step handlers. Implement via class. */
export interface IStepHandler {
  run: (step: FlowStep, context: StepContext) => Promise<StepResult>
  validate?: (step: FlowStep) => true | string
}

/** Registry: step type -> IStepHandler. Merged with default (default first, then options.registry). */
export type StepRegistry = Record<string, IStepHandler>

export interface RunOptions {
  dryRun?: boolean
  params?: Record<string, unknown>
  flowFilePath?: string
  registry?: StepRegistry
}

export interface RunResult {
  flowName: string
  success: boolean
  steps: StepResult[]
  error?: string
}
