import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

describe('flow list', () => {
  it('exits 0 and prints "No flows found" when cwd has no flow yaml', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-list-'))
    const result = await runWithParse(['list'], dir)
    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(/No flows found|Total: 0/)
  })

  it('exits 0 and prints table with flowId, name when flows exist in cwd', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-list-'))
    const flowPath = join(dir, 'a.yaml')
    writeFileSync(flowPath, 'name: flow-a\nsteps: []')
    const result = await runWithParse(['list'], dir)
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('| flowId | name |')
    expect(result.stdout).toContain('flow-a')
    expect(result.stdout).toContain('a.yaml')
  })

  it('uses config flowsDir when --config points to config with flowsDir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-list-'))
    const flowsDir = join(dir, 'flows')
    mkdirSync(flowsDir, { recursive: true })
    const configPath = join(dir, 'runflow.config.mjs')
    const flowPath = join(flowsDir, 'b.yaml')
    writeFileSync(configPath, 'export default { flowsDir: "flows" }\n')
    writeFileSync(flowPath, 'name: flow-b\nsteps: []')
    const result = await runWithParse(['list', '--config', configPath], dir)
    unlinkSync(flowPath)
    unlinkSync(configPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('flow-b')
    expect(result.stdout).toMatch(/b\.yaml|flows\/b\.yaml/)
  })

  it('respects --limit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-list-'))
    writeFileSync(join(dir, 'a.yaml'), 'name: a\nsteps: []')
    writeFileSync(join(dir, 'b.yaml'), 'name: b\nsteps: []')
    writeFileSync(join(dir, 'c.yaml'), 'name: c\nsteps: []')
    const result = await runWithParse(['list', '--limit', '2'], dir)
    unlinkSync(join(dir, 'a.yaml'))
    unlinkSync(join(dir, 'b.yaml'))
    unlinkSync(join(dir, 'c.yaml'))
    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(/Total: 3|Showing 1-2/)
    expect(result.stdout).toContain('offset=2')
  })

  it('respects --keyword filter (case-insensitive)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-list-'))
    writeFileSync(join(dir, 'hello-flow.yaml'), 'name: Hello World\nsteps: []')
    writeFileSync(join(dir, 'other.yaml'), 'name: Other\nsteps: []')
    const result = await runWithParse(['list', '--keyword', 'hello'], dir)
    unlinkSync(join(dir, 'hello-flow.yaml'))
    unlinkSync(join(dir, 'other.yaml'))
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Hello World')
    expect(result.stdout).not.toContain('Other')
  })

  it('--json outputs JSON with total and entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-list-'))
    writeFileSync(join(dir, 'x.yaml'), 'name: x\nsteps: []')
    const result = await runWithParse(['list', '--json'], dir)
    unlinkSync(join(dir, 'x.yaml'))
    expect(result.code).toBe(0)
    const data = JSON.parse(result.stdout) as { total: number, entries: Array<{ flowId: string, name: string }> }
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('entries')
    expect(Array.isArray(data.entries)).toBe(true)
    expect(data.total).toBeGreaterThanOrEqual(1)
    const found = data.entries.find(e => e.flowId === 'x.yaml' || e.name === 'x')
    expect(found).toBeDefined()
  })
})
