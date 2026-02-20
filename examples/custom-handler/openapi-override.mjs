// OpenAPI override example: path is already in step.url (executor substituted {{ params.userId }} etc).
// Injects query: t=timestamp plus all other params except body/token (e.g. limit, offset from simple.yaml).
// Injects header: Authorization Bearer <token> when params.token is set.
function validate(step) {
  if (typeof step.url !== 'string')
    return 'openapi-override step requires url (string)'
  return true
}

function kill() {}

async function run(step, context) {
  const params = context.params ?? {}
  const timestamp = params.timestamp != null ? String(params.timestamp) : String(Date.now())
  const token = params.token != null ? String(params.token) : ''
  const urlRaw = step.url
  const url = new URL(urlRaw)
  url.searchParams.set('t', timestamp)
  for (const [k, v] of Object.entries(params)) {
    if (k === 'body' || k === 'token' || k === 'timestamp' || v === undefined || v === null)
      continue
    url.searchParams.set(k, String(v))
  }
  const method = (step.method ?? 'GET').toUpperCase()
  const headers = { ...(step.headers && typeof step.headers === 'object' ? step.headers : {}) }
  if (token)
    headers.Authorization = `Bearer ${token}`
  const body = typeof step.body === 'string' ? step.body : undefined
  try {
    const res = await fetch(url.toString(), { method, headers, body })
    const contentType = res.headers.get('content-type') ?? ''
    let bodyValue
    if (contentType.includes('application/json'))
      bodyValue = await res.json()
    else
      bodyValue = await res.text()
    const responseObject = { statusCode: res.status, headers: Object.fromEntries(res.headers), body: bodyValue }
    return context.stepResult(step.id, true, { outputs: responseObject })
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return context.stepResult(step.id, false, { error: message })
  }
}

export default { validate, kill, run }
