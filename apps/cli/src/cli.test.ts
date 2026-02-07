import { spawnSync } from 'node:child_process'
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    type: command
    run: echo ok
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
    type: command
    run: exit 1
`)
    const result = runFlow(['run', flowPath, '--dry-run'], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
  })

  it('passes --param to flow: js step receives params', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, `
name: param-flow
steps:
  - id: j1
    type: js
    run: console.log(JSON.stringify(params))
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
  - id: j1
    type: js
    run: "console.log(JSON.stringify({ a: params.a, b: params.b }))"
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
    writeFileSync(flowPath, 'name: x\nsteps:\n  - id: s1\n    type: command\n    run: echo ok\n')
    const result = runFlow(['run', flowPath, '--params-file', join(dir, 'nonexistent.json')], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Failed to read|not found|Error/i)
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
    type: command
    run: echo hi
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
    writeFileSync(flowPath, 'name: x\nsteps:\n  - id: s1\n    type: command\n    run: echo ok\n')
    const result = runFlow(['params', flowPath], process.cwd())
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('No params declared.')
  })
})
