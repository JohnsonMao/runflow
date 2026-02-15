import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

describe('flow detail', () => {
  it('exits 1 when flowId is not in catalog', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-detail-'))
    const result = await runWithParse(['detail', 'nonexistent.yaml'], dir)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not found|Flow not found/)
  })

  it('exits 0 and prints name, description, params when flow exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-detail-'))
    const flowPath = join(dir, 'with-desc.yaml')
    writeFileSync(flowPath, [
      'name: My Flow',
      'description: A test flow',
      'params:',
      '  - name: x',
      '    type: string',
      'steps: []',
    ].join('\n'))
    const result = await runWithParse(['detail', 'with-desc.yaml'], dir)
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('My Flow')
    expect(result.stdout).toContain('A test flow')
    expect(result.stdout).toContain('x')
  })

  it('--json outputs single entry as JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-detail-'))
    const flowPath = join(dir, 'j.yaml')
    writeFileSync(flowPath, 'name: J\nsteps: []')
    const result = await runWithParse(['detail', 'j.yaml', '--json'], dir)
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    const entry = JSON.parse(result.stdout) as { flowId: string, name: string }
    expect(entry.flowId).toBe('j.yaml')
    expect(entry.name).toBe('J')
  })
})
