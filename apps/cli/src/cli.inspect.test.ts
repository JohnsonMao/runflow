import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

describe('flow inspect', () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'flow-inspect-test-'))
    originalCwd = process.cwd()
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('saves snapshot to .runflow/runs/latest.json after run', async () => {
    const flowPath = join(tempDir, 'flow.yaml')
    const yaml = [
      'name: test-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { data: "hello" }',
      '    dependsOn: []',
    ].join('\n')
    writeFileSync(flowPath, yaml)

    const result = await runWithParse(['run', flowPath], tempDir)
    expect(result.code, result.stderr).toBe(0)

    const snapshotPath = join(tempDir, '.runflow', 'runs', 'latest.json')
    expect(existsSync(snapshotPath)).toBe(true)

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    expect(snapshot.success).toBe(true)
    expect(snapshot.steps[0].stepId).toBe('s1')
    expect(snapshot.steps[0].outputs).toEqual({ data: 'hello' })
  })

  it('inspect command queries snapshot with expression', async () => {
    const runflowDir = join(tempDir, '.runflow', 'runs')
    mkdirSync(runflowDir, { recursive: true })
    const snapshot = {
      success: true,
      steps: [
        { stepId: 's1', outputs: { items: [{ id: 1 }, { id: 2 }] } },
      ],
    }
    writeFileSync(join(runflowDir, 'latest.json'), JSON.stringify(snapshot))

    // Test full snapshot
    const res1 = await runWithParse(['inspect'], tempDir)
    expect(res1.code, res1.stderr).toBe(0)
    expect(JSON.parse(res1.stdout)).toEqual(snapshot)

    // Test expression
    const res2 = await runWithParse(['inspect', 'steps[0].outputs.items.map(id)'], tempDir)
    expect(res2.code, res2.stderr).toBe(0)
    expect(JSON.parse(res2.stdout)).toEqual([1, 2])
  })

  it('inspect command prints error when snapshot missing', async () => {
    const result = await runWithParse(['inspect'], tempDir)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('No execution snapshot found')
  })
})
