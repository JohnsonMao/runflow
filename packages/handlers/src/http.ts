// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'
import { Buffer } from 'node:buffer'
import { isPlainObject } from '@runflow/core'

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

export class HttpHandler implements IStepHandler {
  private abortController: AbortController | null = null

  validate(step: FlowStep): true | string {
    return typeof step.url === 'string' ? true : 'http step requires url (string)'
  }

  kill(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const valid = this.validate(step)
    if (valid !== true)
      return context.stepResult(step.id, false, { error: valid })
    const urlRaw = step.url as string
    let url: URL
    try {
      url = new URL(urlRaw)
    }
    catch {
      return context.stepResult(step.id, false, { error: 'http step url is invalid' })
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return context.stepResult(step.id, false, { error: 'http step only allows http and https' })
    const allowedHosts = context.allowedHttpHosts
    if (allowedHosts !== undefined && Array.isArray(allowedHosts) && allowedHosts.length > 0) {
      const hostLower = url.hostname.toLowerCase()
      const allowed = allowedHosts.some(h => String(h).toLowerCase() === hostLower)
      if (!allowed)
        return context.stepResult(step.id, false, { error: `http step host not allowed: ${url.hostname}. Allowed: ${allowedHosts.join(', ')}` })
    }
    const pathOpt = typeof step.path === 'string' ? step.path : undefined
    const queryOpt = step.query !== undefined && (typeof step.query === 'string' || isPlainObject(step.query)) ? step.query as Record<string, string> | string : undefined
    const finalUrl = buildRequestUrl(urlRaw, pathOpt, queryOpt)
    return this.doRequest(step, context, finalUrl)
  }

  private async doRequest(step: FlowStep, context: StepContext, url: string): Promise<StepResult> {
    const method = (typeof step.method === 'string' ? step.method : 'GET')
    const headers: Record<string, string> = {}
    if (step.headers !== undefined && isPlainObject(step.headers)) {
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
      else if (isPlainObject(step.cookie)) {
        cookieVal = serializeCookie(Object.fromEntries(
          Object.entries(step.cookie).map(([k, v]) => [k, String(v)]),
        ))
      }
      if (cookieVal) {
        headers.Cookie = cookieVal
      }
    }
    const body = typeof step.body === 'string' ? step.body : undefined
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    try {
      const init: RequestInit = {
        method: method || 'GET',
        headers: Object.keys(headers).length ? headers : undefined,
        body: body !== undefined && body !== '' ? body : undefined,
        signal,
      }
      const response = await fetch(url, init)
      this.abortController = null
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
      const log = `${methodStr} ${url} → ${statusCode}`
      return context.stepResult(step.id, true, { outputs: responseObject, log })
    }
    catch (e) {
      this.abortController = null
      const message = e instanceof Error ? e.message : String(e)
      const isAbort = e instanceof Error && e.name === 'AbortError'
      return context.stepResult(step.id, false, { error: isAbort ? 'request aborted' : message })
    }
  }
}
