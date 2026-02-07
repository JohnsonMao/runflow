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

export interface FlowStepCommand {
  id: string
  type: 'command'
  run: string
}

export interface FlowStepJs {
  id: string
  type: 'js'
  run: string
  file?: string
}

export interface FlowStepHttp {
  id: string
  type: 'http'
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  output?: string
  allowErrorStatus?: boolean
}

export type FlowStep = FlowStepCommand | FlowStepJs | FlowStepHttp

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
}

export interface RunOptions {
  dryRun?: boolean
  params?: Record<string, unknown>
  flowFilePath?: string
}

export interface RunResult {
  flowName: string
  success: boolean
  steps: StepResult[]
  error?: string
}
