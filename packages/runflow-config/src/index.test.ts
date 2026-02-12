import type { ResolvedFileFlow, ResolvedOpenApiFlow, RunflowConfig } from './index'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONFIG_NAMES,
  findConfigFile,
  loadConfig,
  resolveFlowId,
} from './index'

describe('loadConfig', () => {
  it('returns null when path does not exist', async () => {
    const p = path.join(tmpdir(), 'runflow-config-nonexist-xyz.mjs')
    expect(await loadConfig(p)).toBeNull()
  })

  it('returns null when path is a directory', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-dir-'))
    expect(await loadConfig(dir)).toBeNull()
  })

  it('returns config when file exists and exports default', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-'))
    const configPath = path.join(dir, 'runflow.config.mjs')
    writeFileSync(
      configPath,
      'export default { flowsDir: "flows", handlers: { echo: "./echo.mjs" } }\n',
      'utf-8',
    )
    const loaded = await loadConfig(configPath)
    expect(loaded).not.toBeNull()
    expect(loaded?.flowsDir).toBe('flows')
    expect(loaded?.handlers?.echo).toBe('./echo.mjs')
  })

  it('returns null when module has no default export', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-no-default-'))
    const configPath = path.join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, 'export const x = 1\n', 'utf-8')
    expect(await loadConfig(configPath)).toBeNull()
  })

  it('returns null when module throws', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-throw-'))
    const configPath = path.join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, 'throw new Error("load error")\n', 'utf-8')
    expect(await loadConfig(configPath)).toBeNull()
  })

  it('returns config when .json file exists and is valid JSON', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-json-'))
    const configPath = path.join(dir, 'runflow.config.json')
    writeFileSync(
      configPath,
      '{"flowsDir":"flows","handlers":{"echo":"./echo.mjs"}}',
      'utf-8',
    )
    const loaded = await loadConfig(configPath)
    expect(loaded).not.toBeNull()
    expect(loaded?.flowsDir).toBe('flows')
    expect(loaded?.handlers?.echo).toBe('./echo.mjs')
  })

  it('returns null when .json is invalid', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-json-bad-'))
    const configPath = path.join(dir, 'runflow.config.json')
    writeFileSync(configPath, 'not json', 'utf-8')
    expect(await loadConfig(configPath)).toBeNull()
  })
})

describe('findConfigFile', () => {
  it('returns null when no config file exists in cwd', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-find-empty-'))
    expect(findConfigFile(dir)).toBeNull()
  })

  it('returns first existing config from CONFIG_NAMES order', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-find-'))
    const mjsPath = path.join(dir, CONFIG_NAMES[0])
    writeFileSync(mjsPath, 'export default {}\n', 'utf-8')
    expect(findConfigFile(dir)).toBe(mjsPath)
  })

  it('returns .js when .mjs does not exist', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-find-js-'))
    const jsPath = path.join(dir, 'runflow.config.js')
    writeFileSync(jsPath, 'export default {}\n', 'utf-8')
    expect(findConfigFile(dir)).toBe(jsPath)
  })

  it('returns .json when only runflow.config.json exists', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-find-json-'))
    const jsonPath = path.join(dir, 'runflow.config.json')
    writeFileSync(jsonPath, '{}', 'utf-8')
    expect(findConfigFile(dir)).toBe(jsonPath)
  })
})

describe('resolveFlowId', () => {
  const configDir = '/project'
  const cwd = '/project'

  it('resolves file flowId relative to flowsDir when config has flowsDir', () => {
    const config: RunflowConfig = { flowsDir: 'flows' }
    const r = resolveFlowId('hello.yaml', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/flows/hello.yaml')
  })

  it('resolves file flowId relative to cwd when no flowsDir', () => {
    const r = resolveFlowId('sub/flow.yaml', null, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/sub/flow.yaml')
  })

  it('resolves absolute file flowId as-is', () => {
    const r = resolveFlowId('/abs/path/flow.yaml', null, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/abs/path/flow.yaml')
  })

  it('resolves openapi flowId as prefix-operation when config has openapi', () => {
    const config: RunflowConfig = {
      openapi: {
        myApi: { specPath: './openapi.yaml' },
      },
    }
    const r = resolveFlowId('myApi-get-users', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.operation).toBe('get-users')
    expect(spec.specPath).toBe('/project/openapi.yaml')
  })

  it('resolves openapi flowId with baseUrl, operationFilter, hooks in options', () => {
    const operationFilter = { method: 'post' as const }
    const config: RunflowConfig = {
      openapi: {
        api: {
          specPath: '/abs/spec.yaml',
          baseUrl: 'https://api.example.com',
          operationFilter,
          hooks: {},
        },
      },
    }
    const r = resolveFlowId('api-post-item', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.specPath).toBe('/abs/spec.yaml')
    expect(spec.operation).toBe('post-item')
    expect(spec.options.baseUrl).toBe('https://api.example.com')
    expect(spec.options.operationFilter).toBe(operationFilter)
    expect(spec.options.hooks).toEqual({})
  })

  it('falls back to file when flowId is prefix only (no operation)', () => {
    const config: RunflowConfig = {
      openapi: { myApi: { specPath: './openapi.yaml' } },
    }
    const r = resolveFlowId('myApi-', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/myApi-')
  })

  it('falls back to file when flowId does not match any openapi prefix', () => {
    const config: RunflowConfig = {
      openapi: { myApi: { specPath: './openapi.yaml' } },
    }
    const r = resolveFlowId('other-get', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/other-get')
  })

  it('skips openapi entries with missing or invalid specPath', () => {
    const config: RunflowConfig = {
      openapi: {
        bad: null as unknown as { specPath: string },
        empty: { specPath: '' },
        noPath: {} as { specPath: string },
        ok: { specPath: './ok.yaml' },
      },
    }
    const r = resolveFlowId('ok-get', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.specPath).toBe('/project/ok.yaml')
  })

  it('treats config.openapi as null when not an object', () => {
    const config = { openapi: 'not-object' } as unknown as RunflowConfig
    const r = resolveFlowId('any-flow', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/any-flow')
  })
})
