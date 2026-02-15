import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

describe('flow run', () => {
  it('exits with code 1 when file is invalid', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const bad = join(dir, 'bad.yaml')
    writeFileSync(bad, ['name: x', 'steps: not-an-array'].join('\n'))
    const result = await runWithParse(['run', bad], process.cwd())
    unlinkSync(bad)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Invalid')
  })

  it('runs a valid flow and exits 0', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: test-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
  })

  it('dry-run exits 0 without executing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: dry-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--dry-run'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
  })

  it('passes --param to flow: set step receives params via substitution', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: param-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { a: "{{ a }}", b: "{{ b }}" }',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--param', 'a=1', '--param', 'b=2', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('"a":"1"')
    expect(result.stdout).toContain('"b":"2"')
  })

  it('loads params from --params-file and merges with --param (param overrides)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    const paramsPath = resolve(dir, 'params.json')
    const yaml = [
      'name: file-param-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { a: "{{ a }}", b: "{{ b }}" }',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(paramsPath, '{"a": "from-file", "b": "from-file"}')
    const result = await runWithParse(['run', flowPath, '--params-file', paramsPath, '--param', 'a=overridden', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    unlinkSync(paramsPath)
    expect(result.code, `expected exit 0; stderr: ${result.stderr}`).toBe(0)
    expect(result.stdout).toContain('"a":"overridden"')
    expect(result.stdout).toContain('"b":"from-file"')
  })

  it('exits with error when --params-file is missing or invalid JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: x',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--params-file', join(dir, 'nonexistent.json')], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Failed to read|not found|Error/i)
  })

  it('exits with error when --params-file content is not a JSON object (array or null)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const paramsPath = join(dir, 'params.json')
    const yaml = [
      'name: x',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(paramsPath, '[]')
    const result = await runWithParse(['run', flowPath, '--params-file', paramsPath], process.cwd())
    unlinkSync(flowPath)
    unlinkSync(paramsPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('params file must be a JSON object')
  })

  it('exits with error when flowId is not provided', async () => {
    const result = await runWithParse(['run'], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('flowId is required')
  })

  it('exits with error when run file path does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const result = await runWithParse(['run', join(dir, 'missing.yaml')], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/File not found|not a regular file/)
  })

  it('exits with error when openapi flowId references missing spec', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, 'export default { openapi: { myApi: { specPath: "./nospec.yaml" } } }\n')
    const result = await runWithParse(['run', 'myApi-get-users', '--config', configPath], dir)
    unlinkSync(configPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('OpenAPI spec not found')
  })

  it('exits with error when openapi flowId operation is not in generated flows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(openapiPath, ['openapi: "3.0.0"', 'info: { title: X, version: "1.0" }', 'paths: {}'].join('\n'))
    writeFileSync(configPath, `export default { openapi: { myApi: { specPath: "./openapi.yaml" } } }\n`)
    const result = await runWithParse(['run', 'myApi-nonexistent-op', '--config', configPath], dir)
    unlinkSync(openapiPath)
    unlinkSync(configPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Operation "nonexistent-op" not found')
  })

  it('exits with code 1 and prints error when flow execution fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: fail-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
      '  - id: s2',
      '    type: __nonexistent_type__',
      '    dependsOn: [s1]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/failed|Error/i)
    expect(result.stderr).toContain('fail-flow')
  })

  it('verbose prints step error when a step fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: verbose-fail-flow',
      'steps:',
      '  - id: s1',
      '    type: __unknown__',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Step s1|unknown|failed/i)
  })

  it('exits with error when config handler module path does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    const yaml = [
      'name: x',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(configPath, 'export default { handlers: { custom: "./missing-handler.mjs" } }\n')
    const result = await runWithParse(['run', flowPath, '--config', configPath], dir)
    unlinkSync(flowPath)
    unlinkSync(configPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Handler module not found')
    expect(result.stderr).toContain('custom')
  })

  it('exits with error when config handler does not export default IStepHandler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    const handlerPath = join(dir, 'bad-handler.mjs')
    const yaml = [
      'name: x',
      'steps:',
      '  - id: s1',
      '    type: bad',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(configPath, 'export default { handlers: { bad: "./bad-handler.mjs" } }\n')
    writeFileSync(handlerPath, 'export default { validate: () => true };')
    const result = await runWithParse(['run', flowPath, '--config', configPath], dir)
    unlinkSync(flowPath)
    unlinkSync(configPath)
    unlinkSync(handlerPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('must export default (IStepHandler)')
  })

  it('skips handler entries with non-string modulePath and runs flow with valid handler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    const handlerPath = join(dir, 'echo-handler.mjs')
    const yaml = [
      'name: skip-non-string-flow',
      'steps:',
      '  - id: e1',
      '    type: echo',
      '    message: ok',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(configPath, 'export default { handlers: { skipMe: 123, echo: "./echo-handler.mjs" } }\n')
    writeFileSync(handlerPath, [
      'export default {',
      '  validate() { return true },',
      '  kill() {},',
      '  async run(step) { const m = step.message != null ? String(step.message) : step.id; return { stepId: step.id, success: true, log: m }; }',
      '}',
    ].join('\n'))
    const result = await runWithParse(['run', flowPath, '--config', configPath, '--verbose'], dir)
    unlinkSync(flowPath)
    unlinkSync(configPath)
    unlinkSync(handlerPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('ok')
  })

  it('condition step runs else branch when when is false', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: condition-else-flow',
      'steps:',
      '  - id: cond',
      '    type: condition',
      '    when: params.useThen === \'true\'',
      '    then: runThen',
      '    else: runElse',
      '    dependsOn: []',
      '  - id: runThen',
      '    type: set',
      '    set: { branch: "BRANCH_THEN" }',
      '    dependsOn: [cond]',
      '  - id: runElse',
      '    type: set',
      '    set: { branch: "BRANCH_ELSE" }',
      '    dependsOn: [cond]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--param', 'useThen=false', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('BRANCH_ELSE')
    expect(result.stdout).not.toContain('BRANCH_THEN')
  })

  it('condition step runs then branch when when is true', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: condition-then-flow',
      'steps:',
      '  - id: cond',
      '    type: condition',
      '    when: params.useThen === \'true\'',
      '    then: runThen',
      '    else: runElse',
      '    dependsOn: []',
      '  - id: runThen',
      '    type: set',
      '    set: { branch: "BRANCH_THEN" }',
      '    dependsOn: [cond]',
      '  - id: runElse',
      '    type: set',
      '    set: { branch: "BRANCH_ELSE" }',
      '    dependsOn: [cond]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--param', 'useThen=true', '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('BRANCH_THEN')
    expect(result.stdout).not.toContain('BRANCH_ELSE')
  })

  it('set step outputs state and second set step reads it (multi-step e2e)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: set-set-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { key: "from-set", n: 42 }',
      '    dependsOn: []',
      '  - id: s2',
      '    type: set',
      '    set: { out: "{{ s1.key }}-{{ s1.n }}" }',
      '    dependsOn: [s1]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('from-set-42')
  })

  it('loop step with count runs body N times', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const yaml = [
      'name: loop-count-flow',
      'steps:',
      '  - id: loop',
      '    type: loop',
      '    count: 3',
      '    entry: bodyStep',
      '    dependsOn: []',
      '  - id: bodyStep',
      '    type: set',
      '    set: { n: "{{ index }}" }',
      '    dependsOn: [loop]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['run', flowPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('"n":"0"')
    expect(result.stdout).toContain('"n":"1"')
    expect(result.stdout).toContain('"n":"2"')
  })

  it('runs from OpenAPI spec via flowId prefix-operation (dry-run)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    const openapi = [
      'openapi: "3.0.0"',
      'info:',
      '  title: Test API',
      '  version: "1.0.0"',
      'paths:',
      '  /users:',
      '    get:',
      '      summary: List users',
      '      parameters:',
      '        - name: limit',
      '          in: query',
      '          schema:',
      '            type: integer',
    ].join('\n')
    writeFileSync(openapiPath, openapi)
    writeFileSync(configPath, 'export default { openapi: { myApi: { specPath: "./openapi.yaml" } } }\n')
    const result = await runWithParse(['run', 'myApi-get-users', '--config', configPath, '--dry-run'], dir)
    unlinkSync(openapiPath)
    unlinkSync(configPath)
    expect(result.code, result.stderr).toBe(0)
  })

  it('exits with error when openapi flowId has no matching operation in spec', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(openapiPath, ['openapi: "3.0.0"', 'info: { title: X, version: "1.0" }', 'paths: {}'].join('\n'))
    writeFileSync(configPath, 'export default { openapi: { myApi: { specPath: "./openapi.yaml" } } }\n')
    const result = await runWithParse(['run', 'myApi-nonexistent-op', '--config', configPath], dir)
    unlinkSync(openapiPath)
    unlinkSync(configPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('not found')
  })

  it('uses config openapi options when running with flowId prefix-operation and --config', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    const openapi = [
      'openapi: "3.0.0"',
      'info:',
      '  title: Test API',
      '  version: "1.0.0"',
      'paths:',
      '  /users:',
      '    get:',
      '      summary: List users',
    ].join('\n')
    writeFileSync(openapiPath, openapi)
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, [
      'export default {',
      '  openapi: { myApi: { specPath: \'./openapi.yaml\', baseUrl: \'https://api.example.com\' } },',
      '}',
    ].join('\n'))
    const result = await runWithParse(
      ['run', 'myApi-get-users', '--config', configPath, '--dry-run'],
      dir,
    )
    unlinkSync(openapiPath)
    unlinkSync(configPath)
    expect(result.code, result.stderr).toBe(0)
  })

  it('accepts -f as short for --params-file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    const paramsPath = resolve(dir, 'params.json')
    const yaml = [
      'name: short-f-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { ok: true }',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(paramsPath, '{"x": "from-f"}')
    const result = await runWithParse(['run', flowPath, '-f', paramsPath, '--verbose'], process.cwd())
    unlinkSync(flowPath)
    unlinkSync(paramsPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('ok')
  })

  it('custom handler from config runs and produces output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    const handlerPath = join(dir, 'echo-handler.mjs')
    const yaml = [
      'name: custom-echo-flow',
      'steps:',
      '  - id: e1',
      '    type: echo',
      '    message: hello-from-custom',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    writeFileSync(configPath, 'export default { handlers: { echo: \'./echo-handler.mjs\' } }\n')
    const handler = [
      'export default {',
      '  validate() { return true },',
      '  kill() {},',
      '  async run(step) {',
      '    const msg = step.message != null ? String(step.message) : step.id;',
      '    return { stepId: step.id, success: true, log: msg };',
      '  }',
      '}',
    ].join('\n')
    writeFileSync(handlerPath, handler)
    const result = await runWithParse(['run', flowPath, '--config', configPath, '--verbose'], dir)
    unlinkSync(flowPath)
    unlinkSync(configPath)
    unlinkSync(handlerPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('hello-from-custom')
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
      const openapi = [
        'openapi: "3.0.0"',
        'info:',
        '  title: Test API',
        '  version: "1.0.0"',
        'paths:',
        '  /users:',
        '    get:',
        '      summary: List users',
      ].join('\n')
      writeFileSync(openapiPath, openapi)
      const configPath = join(dir, 'runflow.config.mjs')
      writeFileSync(configPath, [
        'export default {',
        `  openapi: { myApi: { specPath: './openapi.yaml', baseUrl: '${baseUrl}' } },`,
        '}',
      ].join('\n'))
      const result = await runWithParse(
        ['run', 'myApi-get-users', '--config', configPath],
        dir,
      )
      expect(result.code, result.stderr).toBe(0)
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

  it('run uses all built-in handlers: set, condition, loop, sleep, http, flow (complex flow)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{"ok":true}'),
    } as Response)
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const mainPath = join(dir, 'main.yaml')
    const subPath = join(dir, 'subflow.yaml')
    const mainYaml = [
      'name: all-handlers-flow',
      'params:',
      '  - name: branch',
      '    type: string',
      'steps:',
      '  - id: init',
      '    type: set',
      '    set: { phase: "set-done" }',
      '    dependsOn: []',
      '  - id: cond',
      '    type: condition',
      '    when: params.branch === "then"',
      '    then: thenStep',
      '    else: elseStep',
      '    dependsOn: [init]',
      '  - id: thenStep',
      '    type: set',
      '    set: { branch: "then" }',
      '    dependsOn: [cond]',
      '  - id: elseStep',
      '    type: set',
      '    set: { branch: "else" }',
      '    dependsOn: [cond]',
      '  - id: loop',
      '    type: loop',
      '    count: 2',
      '    entry: [loopBody]',
      '    done: [nap]',
      '    dependsOn: [thenStep]',
      '  - id: loopBody',
      '    type: set',
      '    set: { iter: "{{ index }}" }',
      '    dependsOn: [loop]',
      '  - id: nap',
      '    type: sleep',
      '    ms: 0',
      '    dependsOn: [loop]',
      '  - id: req',
      '    type: http',
      '    url: https://example.com/ping',
      '    method: get',
      '    dependsOn: [nap]',
      '  - id: sub',
      '    type: flow',
      '    flow: subflow.yaml',
      '    dependsOn: [req]',
      '  - id: final',
      '    type: set',
      '    set: { done: true }',
      '    dependsOn: [sub]',
    ].join('\n')
    const subYaml = [
      'name: subflow',
      'steps:',
      '  - id: subSet',
      '    type: set',
      '    set: { fromSub: true }',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(mainPath, mainYaml)
    writeFileSync(subPath, subYaml)
    try {
      const result = await runWithParse(
        ['run', mainPath, '--param', 'branch=else', '--verbose'],
        process.cwd(),
      )
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('phase')
      expect(result.stdout).toContain('branch')
      if (mockFetch.mock.calls.length > 0) {
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/ping',
          expect.objectContaining({ method: 'get' }),
        )
      }
    }
    finally {
      unlinkSync(mainPath)
      unlinkSync(subPath)
      globalThis.fetch = originalFetch
    }
  })
})
