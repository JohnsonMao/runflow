import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

describe('flow validate', () => {
  it('exits 0 and prints success message when all flows are valid', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-validate-'))
    const flowPath = join(dir, 'a.yaml')
    writeFileSync(flowPath, 'name: flow-a\nsteps: []')
    const result = await runWithParse(['validate'], dir)
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('All flows are valid')
  })

  it('exits 1 and prints errors when duplicate flowIds are found', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-validate-'))
    const flowPath1 = join(dir, 'a.yaml')
    const flowPath2 = join(dir, 'b.yaml')
    // Both define the same id
    writeFileSync(flowPath1, 'id: my-shared-id\nsteps: []')
    writeFileSync(flowPath2, 'id: my-shared-id\nsteps: []')

    const result = await runWithParse(['validate'], dir)

    unlinkSync(flowPath1)
    unlinkSync(flowPath2)

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Found 1 error(s)')
    expect(result.stderr).toContain('Duplicate flowId: my-shared-id')
  })

  it('uses custom config when --config is provided', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-validate-'))
    const configPath = join(dir, 'custom.config.mjs')
    const flowPath = join(dir, 'a.yaml')

    writeFileSync(configPath, 'export default { flowsDir: "." }\n')
    writeFileSync(flowPath, 'id: custom-id\nsteps: []')

    const result = await runWithParse(['validate', '--config', configPath], dir)

    unlinkSync(configPath)
    unlinkSync(flowPath)

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('All flows are valid')
  })
})
