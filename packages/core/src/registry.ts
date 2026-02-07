import type { IStepHandler, StepRegistry } from './types'
import { CommandHandler } from './handlers/command'
import { HttpHandler } from './handlers/http'
import { JsHandler } from './handlers/js'

export function createDefaultRegistry(): StepRegistry {
  return {
    command: new CommandHandler(),
    js: new JsHandler(),
    http: new HttpHandler(),
  }
}

export function registerStepHandler(registry: StepRegistry, type: string, handler: IStepHandler): void {
  registry[type] = handler
}
