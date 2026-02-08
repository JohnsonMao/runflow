// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { Buffer } from 'node:buffer'
import { isPlainObject } from '../utils'

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

  async run(step: FlowStep, _context: StepContext): Promise<StepResult> {
    const valid = this.validate(step)
    if (valid !== true) {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: valid,
      }
    }
    const outputKey = (typeof step.outputKey === 'string' ? step.outputKey : step.id) as string
    return this.doRequest(step, step.url as string, outputKey)
  }

  private async doRequest(step: FlowStep, url: string, outputKey: string): Promise<StepResult> {
    const method = (typeof step.method === 'string' ? step.method : 'GET')
    const headers: Record<string, string> = {}
    if (step.headers !== undefined && isPlainObject(step.headers)) {
      for (const [k, v] of Object.entries(step.headers)) {
        if (typeof v === 'string')
          headers[k] = v
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
      return {
        stepId: step.id,
        success: true,
        stdout: '',
        stderr: '',
        outputs: { [outputKey]: responseObject },
      }
    }
    catch (e) {
      this.abortController = null
      const message = e instanceof Error ? e.message : String(e)
      const isAbort = e instanceof Error && e.name === 'AbortError'
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: isAbort ? 'request aborted' : message,
      }
    }
  }
}
