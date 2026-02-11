import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const EXIT_CODE_SENTINEL = 'CLI_EXIT:'

async function runWithParse(
  args: string[],
  cwd?: string,
): Promise<{ code: number, stdout: string, stderr: string }> {
  vi.resetModules()
  const { program } = await import('./cli.js')
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const exitMock = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`${EXIT_CODE_SENTINEL}${code ?? 0}`)
  })
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk))
    return true
  })
  const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk))
    return true
  })
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    stderrChunks.push(a.map(String).join(' '))
  })
  const consoleLog = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    stdoutChunks.push(a.map(String).join(' '))
  })
  const origCwd = process.cwd()
  if (cwd)
    process.chdir(cwd)
  try {
    await program.parseAsync(['node', 'flow', ...args])
    return { code: 0, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith(EXIT_CODE_SENTINEL)) {
      const code = Number.parseInt(msg.slice(EXIT_CODE_SENTINEL.length), 10) || 0
      return { code, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
    }
    throw e
  }
  finally {
    exitMock.mockRestore()
    stdoutWrite.mockRestore()
    stderrWrite.mockRestore()
    consoleError.mockRestore()
    consoleLog.mockRestore()
    if (cwd)
      process.chdir(origCwd)
  }
}

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

  it('exits with error when neither file nor --from-openapi is provided', async () => {
    const result = await runWithParse(['run'], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Either <file> or --from-openapi is required')
  })

  it('exits with error when run file path does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const result = await runWithParse(['run', join(dir, 'missing.yaml')], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/File not found|not a regular file/)
  })

  it('exits with error when --from-openapi spec path does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const result = await runWithParse(['run', '--from-openapi', join(dir, 'nospec.yaml'), '--operation', 'get-users'], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('OpenAPI spec not found')
  })

  it('exits with error when --from-openapi --operation is not in generated flows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    writeFileSync(openapiPath, ['openapi: "3.0.0"', 'info: { title: X, version: "1.0" }', 'paths: {}'].join('\n'))
    const result = await runWithParse(['run', '--from-openapi', openapiPath, '--operation', 'nonexistent-op'], dir)
    unlinkSync(openapiPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Operation "nonexistent-op" not found')
  })

  it('exits with error when --registry path does not exist', async () => {
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
    const result = await runWithParse(['run', flowPath, '--registry', join(dir, 'no-registry.mjs')], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Registry file not found')
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
      '    set: { out: "{{ key }}-{{ n }}" }',
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
      '    body: bodyStep',
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

  it('runs from OpenAPI spec with --from-openapi and --operation (dry-run)', async () => {
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
      '      parameters:',
      '        - name: limit',
      '          in: query',
      '          schema:',
      '            type: integer',
    ].join('\n')
    writeFileSync(openapiPath, openapi)
    const result = await runWithParse(['run', '--from-openapi', openapiPath, '--operation', 'get-users', '--dry-run'], dir)
    unlinkSync(openapiPath)
    expect(result.code, result.stderr).toBe(0)
  })

  it('exits with error when --from-openapi without --operation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const openapiPath = join(dir, 'openapi.yaml')
    writeFileSync(openapiPath, [
      'openapi: "3.0.0"',
      'info: { title: X, version: "1.0" }',
      'paths: {}',
    ].join('\n'))
    const result = await runWithParse(['run', '--from-openapi', openapiPath], dir)
    unlinkSync(openapiPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('--operation is required')
  })

  it('uses config openapi options when running with --from-openapi and --config', async () => {
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
      '  openapi: { baseUrl: \'https://api.example.com\' },',
      '}',
    ].join('\n'))
    const result = await runWithParse(
      ['run', '--config', configPath, '--from-openapi', openapiPath, '--operation', 'get-users', '--dry-run'],
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
      '    return { stepId: step.id, success: true, stdout: msg + "\\n", stderr: "" };',
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

  it('--registry merges handlers and custom step runs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    const registryPath = join(dir, 'registry.mjs')
    const yaml = [
      'name: registry-echo-flow',
      'steps:',
      '  - id: e1',
      '    type: customEcho',
      '    message: from-registry',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const registry = [
      'export default {',
      '  customEcho: {',
      '    validate() { return true },',
      '    kill() {},',
      '    async run(step) {',
      '      const msg = step.message != null ? String(step.message) : step.id;',
      '      return { stepId: step.id, success: true, stdout: msg + "\\n", stderr: "" };',
      '    }',
      '  }',
      '}',
    ].join('\n')
    writeFileSync(registryPath, registry)
    const result = await runWithParse(['run', flowPath, '--registry', registryPath, '--verbose'], dir)
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
        `  openapi: { baseUrl: '${baseUrl}' },`,
        '}',
      ].join('\n'))
      const result = await runWithParse(
        ['run', '--config', configPath, '--from-openapi', openapiPath, '--operation', 'get-users'],
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
      '    body: loopBody',
      '    dependsOn: [cond]',
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

describe('flow params', () => {
  it('lists params when flow declares them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    const yaml = [
      'name: param-list-flow',
      'params:',
      '  - name: who',
      '    type: string',
      '    required: true',
      '    description: Who to greet',
      '  - name: count',
      '    type: number',
      '    default: 1',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['params', flowPath], process.cwd())
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

  it('prints "No params declared." when flow has no params', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = resolve(dir, 'flow.yaml')
    const yaml = [
      'name: x',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['params', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('No params declared.')
  })

  it('exits with error when params file does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const result = await runWithParse(['params', join(dir, 'missing.yaml')], process.cwd())
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/File not found|not a regular file/)
  })

  it('exits with error when params flow file is invalid', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'bad.yaml')
    writeFileSync(flowPath, ['name: x', 'steps: not-an-array'].join('\n'))
    const result = await runWithParse(['params', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Invalid|unreadable/)
  })
})

describe('flow CLI global', () => {
  it('--version exits 0 and prints version', async () => {
    const result = await runWithParse(['--version'], process.cwd())
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('--help exits 0 and prints usage', async () => {
    const result = await runWithParse(['--help'], process.cwd())
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('flow')
    expect(result.stdout).toContain('run')
    expect(result.stdout).toContain('params')
  })
})
