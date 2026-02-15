import { describe, expect, it } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

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
