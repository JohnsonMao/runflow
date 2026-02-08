import type { IStepHandler, StepRegistry } from './types'
import { CommandHandler } from './handlers/command'
import { ConditionHandler } from './handlers/condition'
import { HttpHandler } from './handlers/http'
import { JsHandler } from './handlers/js'

export function createDefaultRegistry(): StepRegistry {
  return {
    command: new CommandHandler(),
    js: new JsHandler(),
    http: new HttpHandler(),
    condition: new ConditionHandler(),
  }
}

export function registerStepHandler(registry: StepRegistry, type: string, handler: IStepHandler): void {
  registry[type] = handler
}
