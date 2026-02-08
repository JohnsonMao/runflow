import type { IStepHandler, StepRegistry } from './types'
import { CommandHandler } from './handlers/command'
import { ConditionHandler } from './handlers/condition'
import { FlowHandler } from './handlers/flow'
import { HttpHandler } from './handlers/http'
import { JsHandler } from './handlers/js'
import { LoopHandler } from './handlers/loop'
import { SetHandler } from './handlers/set'
import { SleepHandler } from './handlers/sleep'

export function createDefaultRegistry(): StepRegistry {
  return {
    command: new CommandHandler(),
    js: new JsHandler(),
    http: new HttpHandler(),
    condition: new ConditionHandler(),
    sleep: new SleepHandler(),
    set: new SetHandler(),
    loop: new LoopHandler(),
    flow: new FlowHandler(),
  }
}

export function registerStepHandler(registry: StepRegistry, type: string, handler: IStepHandler): void {
  registry[type] = handler
}
