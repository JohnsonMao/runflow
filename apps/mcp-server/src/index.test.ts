import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfigOnce } from './index'

describe('loadConfigOnce', () => {
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
  })
  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('returns config and registry when runflow.config.mjs exists with handlers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-config-'))
    const configPath = join(dir, 'runflow.config.mjs')
    const handlerPath = join(dir, 'echo.mjs')
    writeFileSync(configPath, 'export default { handlers: { echo: "./echo.mjs" } }\n')
    writeFileSync(handlerPath, [
      'export default {',
      '  validate() { return true },',
      '  kill() {},',
      '  async run(step) { return { stepId: step.id, success: true }; }',
      '}',
    ].join('\n'))
    process.chdir(dir)
    const result = await loadConfigOnce()
    expect(result.config).not.toBeNull()
    expect(result.config?.handlers?.echo).toBe('./echo.mjs')
    expect(result.registry.echo).toBeDefined()
    expect(typeof result.registry.echo?.run).toBe('function')
    unlinkSync(configPath)
    unlinkSync(handlerPath)
  })

  it('skips non-string handler entries and failed handler imports', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-config-skip-'))
    const configPath = join(dir, 'runflow.config.mjs')
    const brokenPath = join(dir, 'broken.mjs')
    writeFileSync(configPath, 'export default { handlers: { skip: 123, broken: "./broken.mjs" } }\n')
    writeFileSync(brokenPath, 'throw new Error("handler load failed")')
    process.chdir(dir)
    const result = await loadConfigOnce()
    expect(result.config).not.toBeNull()
    expect(result.registry.skip).toBeUndefined()
    expect(result.registry.broken).toBeUndefined()
    unlinkSync(configPath)
    unlinkSync(brokenPath)
  })
})
