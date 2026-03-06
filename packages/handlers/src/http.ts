// @env node
import type { FactoryContext } from '@runflow/core'
import { Buffer } from 'node:buffer'
import { evaluateToBoolean } from '@runflow/core'

function buildRequestUrl(baseUrlStr: string, path?: string, query?: Record<string, string> | string): string {
  const url = new URL(baseUrlStr)
  if (path !== undefined && path !== '') {
    url.pathname = path.startsWith('/') ? path : `/${path}`
  }
  if (query !== undefined) {
    if (typeof query === 'string')
      url.search = query.startsWith('?') ? query.slice(1) : query
    else
      url.search = new URLSearchParams(query).toString()
  }
  return url.toString()
}

function serializeCookie(cookie: Record<string, string> | string): string {
  if (typeof cookie === 'string')
    return cookie
  return Object.entries(cookie)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('; ')
}

function httpHandler({ defineHandler, z, utils }: FactoryContext) {
  return defineHandler({
    type: 'http',
    schema: z.object({
      // Allow template strings ({{ ... }}) or relative paths, not just full URLs
      // Actual URL validation happens at runtime after template substitution
      url: z.string().min(1),
      method: z.string().optional(),
      path: z.string().optional(),
      query: z.union([z.string(), z.record(z.string())]).optional(),
      headers: z.record(z.string()).optional(),
      cookie: z.union([z.string(), z.record(z.string())]).optional(),
      body: z.string().optional(),
      allowedHttpHosts: z.array(z.string()).optional(),
      successCondition: z.string().optional(),
    }),
    run: async (context) => {
      const { step, signal } = context
      const urlRaw = step.url

      let url: URL
      try {
        url = new URL(urlRaw)
      }
      catch {
        return {
          success: false,
          error: 'http step url is invalid',
        }
      }

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return {
          success: false,
          error: 'http step only allows http and https',
        }
      }

      const allowedHosts = step.allowedHttpHosts
      if (allowedHosts !== undefined && Array.isArray(allowedHosts) && allowedHosts.length > 0) {
        const hostLower = url.hostname.toLowerCase()
        const allowed = allowedHosts.some(h => String(h).toLowerCase() === hostLower)
        if (!allowed) {
          return {
            success: false,
            error: `http step host not allowed: ${url.hostname}. Allowed: ${allowedHosts.join(', ')}`,
          }
        }
      }

      const pathOpt = typeof step.path === 'string' ? step.path : undefined
      const queryOpt = step.query !== undefined && (typeof step.query === 'string' || utils.isPlainObject(step.query))
        ? step.query
        : undefined
      const finalUrl = buildRequestUrl(urlRaw, pathOpt, queryOpt)

      const method = (typeof step.method === 'string' ? step.method : 'GET')
      const headers: Record<string, string> = {}

      if (step.headers !== undefined && utils.isPlainObject(step.headers) && step.headers !== null) {
        for (const [k, v] of Object.entries(step.headers)) {
          if (typeof v === 'string')
            headers[k] = v
        }
      }

      if (step.cookie !== undefined) {
        let cookieVal = ''
        if (typeof step.cookie === 'string') {
          cookieVal = step.cookie
        }
        else if (utils.isPlainObject(step.cookie) && step.cookie !== null) {
          cookieVal = serializeCookie(Object.fromEntries(
            Object.entries(step.cookie).map(([k, v]) => [k, String(v)]),
          ))
        }
        if (cookieVal) {
          headers.Cookie = cookieVal
        }
      }

      const body = typeof step.body === 'string' ? step.body : undefined

      try {
        const init: RequestInit = {
          method: method || 'GET',
          headers: Object.keys(headers).length ? headers : undefined,
          body: body !== undefined && body !== '' ? body : undefined,
          signal,
        }
        const response = await fetch(finalUrl, init)
        const statusCode = response.status
        const headersObj: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          headersObj[key] = value
        })
        const contentType = response.headers.get('content-type') ?? ''
        let bodyValue: unknown
        if (/^image\//.test(contentType) || contentType.includes('application/octet-stream')) {
          const buf = await response.arrayBuffer()
          bodyValue = Buffer.from(buf).toString('base64')
        }
        else if (contentType.includes('application/json')) {
          const text = await response.text()
          try {
            bodyValue = text ? JSON.parse(text) : null
          }
          catch {
            bodyValue = text
          }
        }
        else {
          bodyValue = await response.text()
        }
        const responseObject = { statusCode, headers: headersObj, body: bodyValue }

        const methodStr = (typeof step.method === 'string' ? step.method : 'GET').toUpperCase()

        let isSuccess = response.ok ?? (response.status >= 200 && response.status < 300)
        let conditionError: string | undefined

        if (isSuccess && step.successCondition) {
          try {
            // Evaluate condition using the current outputs (responseObject)
            const evalCtx = { ...context.params, ...responseObject }
            isSuccess = evaluateToBoolean(step.successCondition, evalCtx)
            if (!isSuccess)
              conditionError = `Success condition failed: ${step.successCondition}`
          }
          catch (e) {
            isSuccess = false
            conditionError = `Condition evaluation error: ${e instanceof Error ? e.message : String(e)}`
          }
        }

        let log = `${methodStr} ${finalUrl} → ${statusCode}`
        if (!isSuccess) {
          let logBody = ''
          if (utils.isPlainObject(bodyValue) || Array.isArray(bodyValue)) {
            logBody = JSON.stringify(utils.redact(bodyValue), null, 2)
          }
          else {
            logBody = String(bodyValue)
          }
          log += `\nBody: ${utils.truncate(logBody)}`
        }

        return {
          success: isSuccess,
          error: conditionError,
          outputs: responseObject,
          log,
        }
      }
      catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        const isAbort = e instanceof Error && e.name === 'AbortError'
        return {
          success: false,
          error: isAbort ? 'request aborted' : message,
        }
      }
    },
  })
}

export default httpHandler
