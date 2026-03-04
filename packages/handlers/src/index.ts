import type { StepRegistry } from '@runflow/core'
import { createFactoryContext, handlerConfigToStepHandler } from '@runflow/core'
import conditionHandlerFactory from './condition'
import flowHandlerFactory from './flow'
import httpHandlerFactory from './http'
import loopHandlerFactory from './loop'
import { MessageHandler } from './message'
import setHandlerFactory from './set'
import sleepHandlerFactory from './sleep'

// Export factories (new pattern)
export { default as condition } from './condition'

export { default as flow } from './flow'
export { default as http } from './http'
export { default as loop } from './loop'
// Export helper functions and constants for tests
export { closureIdsThatDependOnDone, computeBackwardClosure, computeLoopClosure } from './loop'
// Export legacy handlers for backward compatibility
export { MessageHandler } from './message'
export { default as set } from './set'
export { default as sleep } from './sleep'
export { SLEEP_MAX_MS } from './sleep'

/** Create a new registry with all built-in handlers. Override or add: `registry.myType = myHandler`. */
export function createBuiltinRegistry(): StepRegistry {
  const factoryContext = createFactoryContext()
  const registry: StepRegistry = {}

  // Initialize factory-based handlers
  const httpConfig = httpHandlerFactory(factoryContext)
  registry.http = handlerConfigToStepHandler(httpConfig)

  const loopConfig = loopHandlerFactory(factoryContext)
  registry.loop = handlerConfigToStepHandler(loopConfig)

  const conditionConfig = conditionHandlerFactory(factoryContext)
  registry.condition = handlerConfigToStepHandler(conditionConfig)

  const setConfig = setHandlerFactory(factoryContext)
  registry.set = handlerConfigToStepHandler(setConfig)

  const sleepConfig = sleepHandlerFactory(factoryContext)
  registry.sleep = handlerConfigToStepHandler(sleepConfig)

  const flowConfig = flowHandlerFactory(factoryContext)
  registry.flow = handlerConfigToStepHandler(flowConfig)

  // Legacy handlers (will be migrated to factories)
  registry.message = new MessageHandler()

  return registry
}

/** Create built-in handlers from factories. Used by callers that want to initialize factories with custom context. */
export function createBuiltinHandlers(factoryContext: ReturnType<typeof createFactoryContext>) {
  return {
    http: handlerConfigToStepHandler(httpHandlerFactory(factoryContext)),
    loop: handlerConfigToStepHandler(loopHandlerFactory(factoryContext)),
    condition: handlerConfigToStepHandler(conditionHandlerFactory(factoryContext)),
    set: handlerConfigToStepHandler(setHandlerFactory(factoryContext)),
    sleep: handlerConfigToStepHandler(sleepHandlerFactory(factoryContext)),
    flow: handlerConfigToStepHandler(flowHandlerFactory(factoryContext)),
    // TODO: Add message handler when refactored
  }
}
