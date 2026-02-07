export interface FlowStepCommand {
  id: string
  type: 'command'
  run: string
}

export interface FlowStepJs {
  id: string
  type: 'js'
  run: string
}

export type FlowStep = FlowStepCommand | FlowStepJs

export interface FlowDefinition {
  name: string
  description?: string
  steps: FlowStep[]
}

export interface StepResult {
  stepId: string
  success: boolean
  stdout: string
  stderr: string
  error?: string
}

export interface RunResult {
  flowName: string
  success: boolean
  steps: StepResult[]
  error?: string
}
