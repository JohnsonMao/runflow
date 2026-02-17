import type { StepRegistry } from '@runflow/core'
import { ConditionHandler } from './condition'
import { FlowHandler } from './flow'
import { HttpHandler } from './http'
import { LoopHandler } from './loop'
import { MessageHandler } from './message'
import { SetHandler } from './set'
import { SleepHandler } from './sleep'

export { ConditionHandler } from './condition'
export { FlowHandler } from './flow'
export { HttpHandler } from './http'
export { LoopHandler } from './loop'
export { MessageHandler } from './message'
export { SetHandler } from './set'
export { SleepHandler } from './sleep'

/** Create a new registry with all built-in handlers. Override or add: `registry.myType = myHandler`. */
export function createBuiltinRegistry(): StepRegistry {
  return {
    http: new HttpHandler(),
    condition: new ConditionHandler(),
    sleep: new SleepHandler(),
    set: new SetHandler(),
    message: new MessageHandler(),
    loop: new LoopHandler(),
    flow: new FlowHandler(),
  }
}
