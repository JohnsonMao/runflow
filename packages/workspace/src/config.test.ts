import type { ResolvedFileFlow, ResolvedOpenApiFlow, RunflowConfig } from './config'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONFIG_NAMES,
  findConfigFile,
  loadConfig,
  mergeParamDeclarations,
  normalizeConfigParams,
  resolveFlowId,
} from './config'

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

  it('returns config with params as ParamDeclaration[] when config has params array', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-params-array-'))
    const configPath = path.join(dir, 'runflow.config.json')
    writeFileSync(
      configPath,
      '{"flowsDir":"flows","params":[{"name":"env","type":"string","default":"development"},{"name":"count","type":"number","default":1}]}',
      'utf-8',
    )
    const loaded = await loadConfig(configPath)
    expect(loaded).not.toBeNull()
    expect(loaded?.params).toHaveLength(2)
    expect(loaded?.params?.[0]).toEqual({ name: 'env', type: 'string', default: 'development' })
    expect(loaded?.params?.[1]).toEqual({ name: 'count', type: 'number', default: 1 })
  })

  it('normalizes legacy params object to ParamDeclaration[] when config has params as object', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'runflow-load-params-legacy-'))
    const configPath = path.join(dir, 'runflow.config.json')
    writeFileSync(
      configPath,
      '{"flowsDir":"flows","params":{"env":"example","name":"Guest"}}',
      'utf-8',
    )
    const loaded = await loadConfig(configPath)
    expect(loaded).not.toBeNull()
    expect(loaded?.params).toHaveLength(2)
    const names = (loaded?.params ?? []).map(p => p.name).sort()
    expect(names).toEqual(['env', 'name'])
    const envParam = loaded?.params?.find(p => p.name === 'env')
    expect(envParam).toEqual({ name: 'env', type: 'string', default: 'example' })
    const nameParam = loaded?.params?.find(p => p.name === 'name')
    expect(nameParam).toEqual({ name: 'name', type: 'string', default: 'Guest' })
  })
})

describe('normalizeConfigParams', () => {
  it('returns undefined for undefined or null', () => {
    expect(normalizeConfigParams(undefined)).toBeUndefined()
    expect(normalizeConfigParams(null)).toBeUndefined()
  })

  it('returns array as-is when raw is already an array', () => {
    const arr = [{ name: 'x', type: 'string' as const, default: 'v' }]
    expect(normalizeConfigParams(arr)).toBe(arr)
  })

  it('converts plain object to ParamDeclaration[] (legacy)', () => {
    const out = normalizeConfigParams({ a: 1, b: 'two' })
    expect(out).toHaveLength(2)
    expect(out?.find(p => p.name === 'a')).toEqual({ name: 'a', type: 'string', default: 1 })
    expect(out?.find(p => p.name === 'b')).toEqual({ name: 'b', type: 'string', default: 'two' })
  })
})

describe('mergeParamDeclarations', () => {
  it('flow overrides config for same param name', () => {
    const config = [
      { name: 'env', type: 'string' as const, default: 'development' },
    ]
    const flow = [
      { name: 'env', type: 'string' as const, default: 'production' },
    ]
    const merged = mergeParamDeclarations(config, flow)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({ name: 'env', type: 'string', default: 'production' })
  })

  it('flow adds new param not in config', () => {
    const config = [
      { name: 'env', type: 'string' as const, default: 'development' },
    ]
    const flow = [
      { name: 'limit', type: 'number' as const, required: true },
    ]
    const merged = mergeParamDeclarations(config, flow)
    expect(merged).toHaveLength(2)
    expect(merged.find(p => p.name === 'env')).toEqual({ name: 'env', type: 'string', default: 'development' })
    expect(merged.find(p => p.name === 'limit')).toEqual({ name: 'limit', type: 'number', required: true })
  })

  it('returns empty array when both undefined', () => {
    expect(mergeParamDeclarations(undefined, undefined)).toEqual([])
  })

  it('returns config when flow is empty', () => {
    const config = [{ name: 'a', type: 'string' as const }]
    expect(mergeParamDeclarations(config, [])).toEqual(config)
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

  it('resolves openapi flowId as handlerKey:operationKey when config has handlers OpenAPI entry', () => {
    const config: RunflowConfig = {
      handlers: {
        myApi: { specPath: './openapi.yaml' },
      },
    }
    const r = resolveFlowId('myApi:get-users', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.operation).toBe('get-users')
    expect(spec.specPath).toBe('/project/openapi.yaml')
    expect(spec.options.stepType).toBe('myApi')
  })

  it('uses longest matching handler key when multiple keys match (e.g. admin and admin-delivery)', () => {
    const config: RunflowConfig = {
      handlers: {
        'admin': { specPath: './admin.yaml' },
        'admin-delivery': { specPath: './admin-delivery.yaml' },
      },
    }
    const r = resolveFlowId('admin-delivery:getOrders', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.operation).toBe('getOrders')
    expect(spec.specPath).toBe('/project/admin-delivery.yaml')
  })

  it('resolves openapi flowId with baseUrl, operationFilter, paramExpose, stepType in options', () => {
    const operationFilter = { method: 'post' as const }
    const config: RunflowConfig = {
      handlers: {
        api: {
          specPath: '/abs/spec.yaml',
          baseUrl: 'https://api.example.com',
          operationFilter,
          paramExpose: { path: true, query: true, body: true },
        },
      },
    }
    const r = resolveFlowId('api:post-item', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.specPath).toBe('/abs/spec.yaml')
    expect(spec.operation).toBe('post-item')
    expect(spec.openApiOperationKey).toBe('post-item')
    expect(spec.openApiSpecPath).toBe('/abs/spec.yaml')
    expect(spec.options.stepType).toBe('api')
    expect(spec.options.baseUrl).toBe('https://api.example.com')
    expect(spec.options.operationFilter).toBe(operationFilter)
    expect(spec.options.paramExpose).toEqual({ path: true, query: true, body: true })
  })

  it('falls back to file when flowId has colon but no operation after it', () => {
    const config: RunflowConfig = {
      handlers: { myApi: { specPath: './openapi.yaml' } },
    }
    const r = resolveFlowId('myApi:', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/myApi:')
  })

  it('falls back to file when flowId handler key is not in config', () => {
    const config: RunflowConfig = {
      handlers: { myApi: { specPath: './openapi.yaml' } },
    }
    const r = resolveFlowId('other:get', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/other:get')
  })

  it('skips handler entries that are not OpenAPI (no specPath or invalid)', () => {
    const config: RunflowConfig = {
      handlers: {
        ok: { specPath: './ok.yaml' },
        skip: './echo.mjs',
      },
    }
    const r = resolveFlowId('ok:get', config, configDir, cwd)
    const spec = r as ResolvedOpenApiFlow
    expect(spec.type).toBe('openapi')
    expect(spec.specPath).toBe('/project/ok.yaml')
  })

  it('treats config.handlers as null when not an object', () => {
    const config = { handlers: 'not-object' } as unknown as RunflowConfig
    const r = resolveFlowId('any-flow', config, configDir, cwd)
    const file = r as ResolvedFileFlow
    expect(file.type).toBe('file')
    expect(file.path).toBe('/project/any-flow')
  })
})
