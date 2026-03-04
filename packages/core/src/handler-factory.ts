/**
 * Handler Factory Pattern: Zero-import factory for defining step handlers.
 * Handlers export: export default ({ defineHandler, z, utils }) => defineHandler({ ... })
 */
import type { FlowDefinition, FlowStep, RunFlowFn, StepResult } from './types'
import { z } from 'zod'
import { evaluateToBoolean } from './safeExpression'
import { isPlainObject, normalizeStepIds } from './utils'

/** Simple result that handlers can return or report via context. */
export interface SimpleResult {
  success: boolean
  error?: string
  outputs?: Record<string, unknown>
  log?: string
  nextSteps?: string[] | null
  completedStepIds?: string[]
  subSteps?: StepResult[]
}

/** Extract FlowStep base fields without index signature. */
interface FlowStepBase {
  id: string
  type: string
  dependsOn?: string[]
  skip?: string
  timeout?: number
  retry?: number
  outputKey?: string
  name?: string
  description?: string
}

/**
 * Extract base ZodObject from ZodEffects (created by refine, superRefine, etc.).
 */
type ExtractZodObject<TSchema extends z.ZodTypeAny> = TSchema extends z.ZodObject<any>
  ? TSchema
  : TSchema extends z.ZodEffects<infer TInner>
    ? ExtractZodObject<TInner>
    : never

/**
 * Infer step type from Zod schema, merging with FlowStep base fields.
 * Schema-inferred fields take precedence over FlowStep's index signature.
 * Supports ZodObject directly and ZodEffects (from refine, superRefine, etc.).
 */
export type InferStepFromSchema<TSchema extends z.ZodTypeAny> = ExtractZodObject<TSchema> extends z.ZodObject<any>
  ? z.infer<ExtractZodObject<TSchema>> & FlowStepBase
  : FlowStep

/** Context passed to handler's run function. */
export interface HandlerContext<TStep extends FlowStep = FlowStep> {
  /** Step being executed (already substituted with params). */
  step: TStep
  /** Merged view of initial params and previous step outputs. */
  params: Record<string, unknown>
  /** Report intermediate or final results. Can be called multiple times. */
  report: (result: SimpleResult) => void
  /** AbortSignal for lifecycle management (timeout, abort). */
  signal: AbortSignal
  /** Run a nested flow (optional, provided by engine). */
  run?: RunFlowFn
  /** Flow steps (provided by engine). Handlers that need the full DAG can use this. */
  steps?: FlowStep[]
  /** Flow map (optional, for flow step handler to look up child flows). */
  flowMap?: Record<string, FlowDefinition>
}

/** Handler configuration returned by defineHandler. */
export interface HandlerConfig<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Optional Zod schema for step validation. */
  schema?: TSchema
  /** Handler's run function with inferred step type from schema. */
  run: (context: HandlerContext<InferStepFromSchema<TSchema>>) => Promise<SimpleResult | void>
  /** Flow control options. */
  flowControl?: {
    /** Return step ids that may have dependsOn including this step. */
    getAllowedDependentIds?: (step: FlowStep) => string[]
  }
}

/** Factory helper function with automatic type inference from schema. */
export interface DefineHandler {
  /** Define handler with ZodObject schema - infers step type from schema. */
  <TSchema extends z.ZodObject<any>>(
    config: {
      schema: TSchema
      run: (context: HandlerContext<z.infer<TSchema> & FlowStepBase>) => Promise<SimpleResult | void>
      flowControl?: HandlerConfig['flowControl']
    }
  ): HandlerConfig<TSchema>
  /** Define handler with ZodEffects schema (from refine, superRefine, etc.) - infers step type from base object. */
  <TSchema extends z.ZodEffects<z.ZodObject<any>>>(
    config: {
      schema: TSchema
      run: (context: HandlerContext<InferStepFromSchema<TSchema>>) => Promise<SimpleResult | void>
      flowControl?: HandlerConfig['flowControl']
    }
  ): HandlerConfig<TSchema>
  /** Define handler without schema - uses default FlowStep type. */
  (
    config: {
      schema?: undefined
      run: (context: HandlerContext) => Promise<SimpleResult | void>
      flowControl?: HandlerConfig['flowControl']
    }
  ): HandlerConfig
  /** Define handler with any Zod schema - fallback for complex schemas. */
  <TSchema extends z.ZodTypeAny>(
    config: HandlerConfig<TSchema>
  ): HandlerConfig<TSchema>
}

/** Factory context injected into handler factories. */
export interface FactoryContext {
  /** Factory helper to define a handler with type inference from Zod schema. */
  defineHandler: DefineHandler
  /** Zod instance for schema validation. */
  z: typeof z
  /** Chainable utility functions. */
  utils: ChainableUtils
}

/** Chainable string wrapper. */
export interface ChainableString {
  /** Substitute template variables (e.g., {{ key }}). */
  substitute: (params: Record<string, unknown>) => ChainableString
  /** Convert to lowercase. */
  lowercase: () => ChainableString
  /** Convert to uppercase. */
  uppercase: () => ChainableString
  /** Trim whitespace. */
  trim: () => ChainableString
  /** Get final string value. */
  value: () => string
}

/** Chainable data wrapper. */
export interface ChainableData {
  /** Pick specific keys from the object. */
  pick: (keys: string[]) => ChainableData
  /** Merge with another object. */
  merge: (other: Record<string, unknown>) => ChainableData
  /** Convert to JSON string. */
  toJSON: () => string
  /** Get final object value. */
  value: () => Record<string, unknown>
}

/** Chainable HTTP client (simplified). */
export interface ChainableHttp {
  get: (url: string) => ChainableHttpRequest
  post: (url: string) => ChainableHttpRequest
  put: (url: string) => ChainableHttpRequest
  delete: (url: string) => ChainableHttpRequest
  patch: (url: string) => ChainableHttpRequest
}

export interface ChainableHttpRequest {
  json: (data: unknown) => ChainableHttpRequest
  body: (data: string) => ChainableHttpRequest
  headers: (headers: Record<string, string>) => ChainableHttpRequest
  send: (signal?: AbortSignal) => Promise<Response>
}

/** Chainable utilities injected into handler factories. */
export interface ChainableUtils {
  /** Chainable string processing. */
  str: (input: string) => ChainableString
  /** Chainable data manipulation. */
  data: (input: Record<string, unknown>) => ChainableData
  /** Optional chainable HTTP client. */
  http?: ChainableHttp
  /** Check if value is a plain object. */
  isPlainObject: (value: unknown) => value is Record<string, unknown>
  /** Normalize step id or array of step ids to string[]. Single string -> [s], array -> filter to strings, else []. */
  normalizeStepIds: (v: unknown) => string[]
  /** Evaluate a safe expression to a boolean. Use for condition/skip. */
  evaluateToBoolean: (expression: string, params: Record<string, unknown>, options?: { maxLength?: number }) => boolean
}

/** Handler factory function signature. Type inference happens inside defineHandler, not at factory level. */
export type HandlerFactory = (context: FactoryContext) => HandlerConfig

/** Create a factory context with injected tools. */
export function createFactoryContext(): FactoryContext {
  const defineHandler: DefineHandler = (config: any): any => {
    return {
      schema: config.schema,
      run: config.run,
      flowControl: config.flowControl,
    }
  }

  const createChainableString = (input: string): ChainableString => {
    const value = input
    return {
      substitute: (params: Record<string, unknown>) => {
        let result = value
        for (const [key, val] of Object.entries(params)) {
          const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
          result = result.replace(pattern, String(val ?? ''))
        }
        return createChainableString(result)
      },
      lowercase: () => createChainableString(value.toLowerCase()),
      uppercase: () => createChainableString(value.toUpperCase()),
      trim: () => createChainableString(value.trim()),
      value: () => value,
    }
  }

  const createChainableData = (input: Record<string, unknown>): ChainableData => {
    const value = { ...input }
    return {
      pick: (keys: string[]) => {
        const picked: Record<string, unknown> = {}
        for (const key of keys) {
          if (key in value)
            picked[key] = value[key]
        }
        return createChainableData(picked)
      },
      merge: (other: Record<string, unknown>) => {
        return createChainableData({ ...value, ...other })
      },
      toJSON: () => JSON.stringify(value),
      value: () => ({ ...value }),
    }
  }

  const createChainableHttp = (): ChainableHttp => {
    const createRequest = (method: string, url: string): ChainableHttpRequest => {
      let bodyData: string | undefined
      let headersData: Record<string, string> = {}
      return {
        json: (data: unknown) => {
          bodyData = JSON.stringify(data)
          headersData['Content-Type'] = 'application/json'
          return createRequest(method, url)
        },
        body: (data: string) => {
          bodyData = data
          return createRequest(method, url)
        },
        headers: (headers: Record<string, string>) => {
          headersData = { ...headersData, ...headers }
          return createRequest(method, url)
        },
        send: async (signal?: AbortSignal) => {
          const init: RequestInit = {
            method,
            headers: Object.keys(headersData).length ? headersData : undefined,
            body: bodyData,
            signal,
          }
          return fetch(url, init)
        },
      }
    }
    return {
      get: (url: string) => createRequest('GET', url),
      post: (url: string) => createRequest('POST', url),
      put: (url: string) => createRequest('PUT', url),
      delete: (url: string) => createRequest('DELETE', url),
      patch: (url: string) => createRequest('PATCH', url),
    }
  }

  return {
    defineHandler,
    z,
    utils: {
      str: createChainableString,
      data: createChainableData,
      http: createChainableHttp(),
      isPlainObject,
      normalizeStepIds,
      evaluateToBoolean,
    },
  }
}
