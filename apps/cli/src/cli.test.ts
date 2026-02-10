import { spawnSync } from 'node:child_process'
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { program } from './cli.js'

const flowBin = join(process.cwd(), 'dist/cli.js')

function runFlow(args: string[], cwd?: string): { stdout: string, stderr: string, code: number } {
  const result = spawnSync('node', [flowBin, ...args], {
    encoding: 'utf-8',
    cwd: cwd ?? join(process.cwd(), '..', '..'),
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? (result.signal ? 128 : 0),
  }
}

describe('flow run', () => {
  it('exits with code 1 when file is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const bad = join(dir, 'bad.yaml')
    writeFileSync(bad, 'name: x\nsteps: not-an-array')
    const result = runFlow(['run', bad], process.cwd())
    unlinkSync(bad)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Invalid')
  })

  it('runs a valid flow and exits 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: test-flow
steps:
  - id: s1
    type: set
    set: {}
    dependsOn: []
`)
    const result = runFlow(['run', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
  })

  it('dry-run exits 0 without executing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: dry-flow
steps:
  - id: s1
    type: set
    set: {}
    dependsOn: []
`)
    const result = runFlow(['run', flowPath, '--dry-run'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
  })

  it('passes --param to flow: set step receives params via substitution', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: param-flow
steps:
  - id: s1
    type: set
    set: { a: "{{ a }}", b: "{{ b }}" }
    dependsOn: []
`)
    const result = runFlow(['run', flowPath, '--param', 'a=1', '--param', 'b=2', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('"a":"1"')
    expect(result.stdout).toContain('"b":"2"')
  })

  it('loads params from --params-file and merges with --param (param overrides)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    const paramsPath = resolve(dir, 'params.json')
    writeFileSync(flowPath, `
name: file-param-flow
steps:
  - id: s1
    type: set
    set: { a: "{{ a }}", b: "{{ b }}" }
    dependsOn: []
`)
    writeFileSync(paramsPath, '{"a": "from-file", "b": "from-file"}')
    const result = runFlow(['run', flowPath, '--params-file', paramsPath, '--param', 'a=overridden', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    unlinkSync(paramsPath)
    expect(result.code, `expected exit 0; stderr: ${result.stderr}`).toBe(0)
    expect(result.stdout).toContain('"a":"overridden"')
    expect(result.stdout).toContain('"b":"from-file"')
  })

  it('exits with error when --params-file is missing or invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, 'name: x\nsteps:\n  - id: s1\n    type: set\n    set: {}\n    dependsOn: []\n')
    const result = runFlow(['run', flowPath, '--params-file', join(dir, 'nonexistent.json')], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Failed to read|not found|Error/i)
  })

  it('condition step runs else branch when when is false', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: condition-else-flow
steps:
  - id: cond
    type: condition
    when: params.useThen === 'true'
    then: runThen
    else: runElse
    dependsOn: []
  - id: runThen
    type: set
    set: { branch: "BRANCH_THEN" }
    dependsOn: [cond]
  - id: runElse
    type: set
    set: { branch: "BRANCH_ELSE" }
    dependsOn: [cond]
`)
    const result = runFlow(['run', flowPath, '--param', 'useThen=false', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('BRANCH_ELSE')
    expect(result.stdout).not.toContain('BRANCH_THEN')
  })

  it('condition step runs then branch when when is true', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: condition-then-flow
steps:
  - id: cond
    type: condition
    when: params.useThen === 'true'
    then: runThen
    else: runElse
    dependsOn: []
  - id: runThen
    type: set
    set: { branch: "BRANCH_THEN" }
    dependsOn: [cond]
  - id: runElse
    type: set
    set: { branch: "BRANCH_ELSE" }
    dependsOn: [cond]
`)
    const result = runFlow(['run', flowPath, '--param', 'useThen=true', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('BRANCH_THEN')
    expect(result.stdout).not.toContain('BRANCH_ELSE')
  })

  it('set step outputs state and second set step reads it (multi-step e2e)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: set-set-flow
steps:
  - id: s1
    type: set
    set: { key: "from-set", n: 42 }
    dependsOn: []
  - id: s2
    type: set
    set: { out: "{{ key }}-{{ n }}" }
    dependsOn: [s1]
`)
    const result = runFlow(['run', flowPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('from-set-42')
  })

  it('loop step with count runs body N times', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: loop-count-flow
steps:
  - id: loop
    type: loop
    count: 3
    body: bodyStep
    dependsOn: []
  - id: bodyStep
    type: set
    set: { n: "{{ index }}" }
    dependsOn: [loop]
`)
    const result = runFlow(['run', flowPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('"n":"0"')
    expect(result.stdout).toContain('"n":"1"')
    expect(result.stdout).toContain('"n":"2"')
  })

  it('runs from OpenAPI spec with --from-openapi and --operation (dry-run)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    writeFileSync(openapiPath, `openapi: "3.0.0"
info:
  title: Test API
  version: "1.0.0"
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
`)
    const result = runFlow(['run', '--from-openapi', openapiPath, '--operation', 'get-users', '--dry-run'], dir)
    if (result.code !== 0)
      console.error(result.stderr)
    expect(result.code, result.stderr).toBe(0)
  })

  it('exits with error when --from-openapi without --operation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    writeFileSync(openapiPath, 'openapi: "3.0.0"\npaths: {}\n')
    const result = runFlow(['run', '--from-openapi', openapiPath], dir)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('--operation is required')
  })

  it('uses config openapi options when running with --from-openapi and --config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    writeFileSync(openapiPath, `openapi: "3.0.0"
info:
  title: Test API
  version: "1.0.0"
paths:
  /users:
    get:
      summary: List users
`)
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, `export default {
  openapi: { baseUrl: 'https://api.example.com' },
}
`)
    const result = runFlow(
      ['run', '--config', configPath, '--from-openapi', openapiPath, '--operation', 'get-users', '--dry-run'],
      dir,
    )
    if (result.code !== 0)
      console.error(result.stderr)
    expect(result.code, result.stderr).toBe(0)
  })

  it('accepts -f as short for --params-file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    const paramsPath = resolve(dir, 'params.json')
    writeFileSync(flowPath, `
name: short-f-flow
steps:
  - id: s1
    type: set
    set: { ok: true }
    dependsOn: []
`)
    writeFileSync(paramsPath, '{"x": "from-f"}')
    const result = runFlow(['run', flowPath, '-f', paramsPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    unlinkSync(paramsPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('ok')
  })

  it('custom handler from config runs and produces output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    const handlerPath = join(dir, 'echo-handler.mjs')
    writeFileSync(flowPath, `
name: custom-echo-flow
steps:
  - id: e1
    type: echo
    message: hello-from-custom
    dependsOn: []
`)
    writeFileSync(configPath, `export default { handlers: { echo: './echo-handler.mjs' } }\n`)
    writeFileSync(handlerPath, `export default {
  validate() { return true },
  kill() {},
  async run(step) {
    const msg = step.message != null ? String(step.message) : step.id;
    return { stepId: step.id, success: true, stdout: msg + "\\n", stderr: "" };
  }
}\n`)
    const result = runFlow(['run', flowPath, '--config', configPath, '--verbose'], dir)
    unlinkSync(flowPath)
    unlinkSync(configPath)
    unlinkSync(handlerPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('hello-from-custom')
  })

  it('--registry merges handlers and custom step runs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const registryPath = join(dir, 'registry.mjs')
    writeFileSync(flowPath, `
name: registry-echo-flow
steps:
  - id: e1
    type: customEcho
    message: from-registry
    dependsOn: []
`)
    writeFileSync(registryPath, `export default {
  customEcho: {
    validate() { return true },
    kill() {},
    async run(step) {
      const msg = step.message != null ? String(step.message) : step.id;
      return { stepId: step.id, success: true, stdout: msg + "\\n", stderr: "" };
    }
  }
}\n`)
    const result = runFlow(['run', flowPath, '--registry', registryPath, '--verbose'], dir)
    unlinkSync(flowPath)
    unlinkSync(registryPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('from-registry')
  })

  it('config openapi baseUrl is used for the actual HTTP request (CLI + mock fetch)', async () => {
    const baseUrl = 'https://api.example.com'
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{}'),
    } as Response)
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    try {
      const openapiPath = join(dir, 'openapi.yaml')
      writeFileSync(openapiPath, `openapi: "3.0.0"
info:
  title: Test API
  version: "1.0.0"
paths:
  /users:
    get:
      summary: List users
`)
      const configPath = join(dir, 'runflow.config.mjs')
      writeFileSync(configPath, `export default {
  openapi: { baseUrl: '${baseUrl}' },
}
`)
      await program.parseAsync([
        'node',
        'flow',
        'run',
        '--config',
        configPath,
        '--from-openapi',
        openapiPath,
        '--operation',
        'get-users',
      ])
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users`,
        expect.objectContaining({ method: 'get' }),
      )
    }
    finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('flow params', () => {
  it('lists params when flow declares them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: param-list-flow
params:
  - name: who
    type: string
    required: true
    description: Who to greet
  - name: count
    type: number
    default: 1
steps:
  - id: s1
    type: set
    set: {}
`)
    const result = runFlow(['params', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('who:')
    expect(result.stdout).toContain('type: string')
    expect(result.stdout).toContain('required: true')
    expect(result.stdout).toContain('description: Who to greet')
    expect(result.stdout).toContain('count:')
    expect(result.stdout).toContain('type: number')
    expect(result.stdout).toContain('default: 1')
  })

  it('prints "No params declared." when flow has no params', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    writeFileSync(flowPath, 'name: x\nsteps:\n  - id: s1\n    type: set\n    set: {}\n    dependsOn: []\n')
    const result = runFlow(['params', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('No params declared.')
  })

  it('exits with error when params file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const result = runFlow(['params', join(dir, 'missing.yaml')], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/File not found|not a regular file/)
  })

  it('exits with error when params flow file is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'bad.yaml')
    writeFileSync(flowPath, 'name: x\nsteps: not-an-array')
    const result = runFlow(['params', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Invalid|unreadable/)
  })
})

describe('flow CLI global', () => {
  it('--version exits 0 and prints version', () => {
    const result = runFlow(['--version'], process.cwd())
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('--help exits 0 and prints usage', () => {
    const result = runFlow(['--help'], process.cwd())
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('flow')
    expect(result.stdout).toContain('run')
    expect(result.stdout).toContain('params')
  })
})
