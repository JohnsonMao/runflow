// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { isPlainObject } from '../utils'

export class HttpHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    return typeof step.url === 'string' ? true : 'http step requires url (string)'
  }

  async run(step: FlowStep, _context: StepContext): Promise<StepResult> {
    const url = step.url
    if (typeof url !== 'string') {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: 'http step requires url (string)',
      }
    }
    const method = (typeof step.method === 'string' ? step.method : 'GET')
    const headers: Record<string, string> = {}
    if (step.headers !== undefined && isPlainObject(step.headers)) {
      for (const [k, v] of Object.entries(step.headers)) {
        if (typeof v === 'string')
          headers[k] = v
      }
    }
    const body = typeof step.body === 'string' ? step.body : undefined
    const outputKey = typeof step.output === 'string' ? step.output : step.id
    const allowErrorStatus = step.allowErrorStatus === true
    try {
      const init: RequestInit = {
        method: method || 'GET',
        headers: Object.keys(headers).length ? headers : undefined,
        body: body !== undefined && body !== '' ? body : undefined,
      }
      const response = await fetch(url, init)
      const statusCode = response.status
      const headersObj: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headersObj[key] = value
      })
      const contentType = response.headers.get('content-type') ?? ''
      let bodyValue: unknown
      if (contentType.includes('application/json')) {
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
      const is2xx = statusCode >= 200 && statusCode < 300
      if (is2xx) {
        return {
          stepId: step.id,
          success: true,
          stdout: '',
          stderr: '',
          outputs: { [outputKey]: responseObject },
        }
      }
      if (allowErrorStatus) {
        return {
          stepId: step.id,
          success: false,
          stdout: '',
          stderr: '',
          error: `HTTP ${statusCode}`,
          outputs: { [outputKey]: responseObject },
        }
      }
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: `HTTP ${statusCode}`,
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: message,
      }
    }
  }
}
