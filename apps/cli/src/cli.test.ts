import { spawnSync } from 'node:child_process'
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
})
