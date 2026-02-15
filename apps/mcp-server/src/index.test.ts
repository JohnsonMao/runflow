import { mkdirSync, mkdtempSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIXTURES_DIR } from './fixtures'
import {
  createConfigLoader,
  discoverFlowDetailTool,
  discoverFlowListTool,
  executeTool,
  findFlowFiles,
  formatRunResult,
  loadConfigOnce,
} from './index'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('formatRunResult', () => {
  it('formats success with flow name, step count, and per-step lines', () => {
    const text = formatRunResult({
      flowName: 'my-flow',
      success: true,
      steps: [{ stepId: 'a', success: true }],
    })
    expect(text).toContain('**Success**')
    expect(text).toContain('my-flow')
    expect(text).toContain('1 step')
    expect(text).toContain('- ✓ a')
  })

  it('formats failure with error and failed step', () => {
    const text = formatRunResult({
      flowName: 'x',
      success: false,
      error: 'Flow failed',
      steps: [
        { stepId: 'a', success: true },
        { stepId: 'b', success: false, error: 'step b failed' },
      ],
    })
    expect(text).toContain('**Failed**')
    expect(text).toContain('Flow failed')
    expect(text).toContain('Step "b"')
    expect(text).toContain('step b failed')
  })

  it('formats failure with error only when no step has error', () => {
    const text = formatRunResult({
      flowName: 'x',
      success: false,
      error: 'Unknown error',
      steps: [{ stepId: 'a', success: true }],
    })
    expect(text).toContain('**Failed**')
    expect(text).toContain('Unknown error')
  })

  it('formats failure with unknown error when result.error is undefined', () => {
    const text = formatRunResult({
      flowName: 'x',
      success: false,
      error: undefined,
      steps: [],
    })
    expect(text).toContain('**Failed**')
    expect(text).toContain('Unknown error')
  })

  it('formats marker steps (iteration_1, iteration_2) without bullet and regular steps with id — log on one line', () => {
    const text = formatRunResult({
      flowName: 'f',
      success: true,
      steps: [
        { stepId: 'init', success: true, log: 'ready' },
        { stepId: 'loop.iteration_1', success: true },
        { stepId: 'loop.iteration_2', success: true },
        { stepId: 'loop', success: true, log: 'done, 2 iteration(s)' },
      ],
    })
    expect(text).toContain('- ✓ init — log: ready')
    expect(text).toContain('  loop [iteration 1]')
    expect(text).toContain('  loop [iteration 2]')
    expect(text).toContain('- ✓ loop — log: done, 2 iteration(s)')
  })
})

describe('findFlowFiles', () => {
  it('returns empty array when path does not exist', () => {
    const files = findFlowFiles(join(__dirname, 'nonexistent-dir-xyz'), ['.yaml'])
    expect(files).toEqual([])
  })

  it('returns empty array when path is a file (not a directory)', () => {
    const files = findFlowFiles(join(__dirname, 'index.test.ts'), ['.yaml'])
    expect(files).toEqual([])
  })

  it('finds yaml files in directory', () => {
    const files = findFlowFiles(FIXTURES_DIR, ['.yaml'])
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(f => f.endsWith('flow.yaml'))).toBe(true)
  })

  it('finds yaml files recursively in subdirectories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-findFlow-'))
    const subDir = join(dir, 'sub')
    const nodeModulesDir = join(dir, 'node_modules')
    mkdirSync(subDir, { recursive: true })
    mkdirSync(nodeModulesDir, { recursive: true })
    const flowPath = join(subDir, 'nested.yaml')
    writeFileSync(flowPath, 'name: nested\nsteps: []')
    writeFileSync(join(dir, 'root.yaml'), 'name: root\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'])
      expect(files).toContain(flowPath)
      expect(files).toContain(join(dir, 'root.yaml'))
      expect(files.some(f => f.includes('node_modules'))).toBe(false)
    }
    finally {
      unlinkSync(flowPath)
      unlinkSync(join(dir, 'root.yaml'))
    }
  })

  it('returns [] when allowedRoot is set and baseDir is outside', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-findFlow-'))
    writeFileSync(join(dir, 'flow.yaml'), 'name: x\nsteps: []')
    const otherRoot = join(tmpdir(), 'other-root-xyz')
    mkdirSync(otherRoot, { recursive: true })
    try {
      const files = findFlowFiles(dir, ['.yaml'], { allowedRoot: otherRoot })
      expect(files).toEqual([])
    }
    finally {
      unlinkSync(join(dir, 'flow.yaml'))
    }
  })

  it('returns [] when baseDir is a symlink', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-findFlow-'))
    const linkPath = join(tmpdir(), 'mcp-symlink-dir')
    try {
      symlinkSync(dir, linkPath, 'dir')
      const files = findFlowFiles(linkPath, ['.yaml'])
      expect(files).toEqual([])
    }
    finally {
      try {
        unlinkSync(linkPath)
      }
      catch {
        /* ignore */
      }
    }
  })

  it('skips symlink files and does not follow symlink dirs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-findFlow-'))
    const realPath = join(dir, 'real.yaml')
    writeFileSync(realPath, 'name: real\nsteps: []')
    const linkPath = join(dir, 'link.yaml')
    try {
      symlinkSync(realPath, linkPath)
      const files = findFlowFiles(dir, ['.yaml'])
      expect(files).toContain(realPath)
      expect(files).not.toContain(linkPath)
      expect(files).toHaveLength(1)
    }
    finally {
      unlinkSync(linkPath)
      unlinkSync(realPath)
    }
  })

  it('stops at maxDepth', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-findFlow-'))
    let current = dir
    for (let i = 0; i < 5; i++) {
      current = join(current, 'sub')
      mkdirSync(current, { recursive: true })
    }
    writeFileSync(join(current, 'deep.yaml'), 'name: deep\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'], { maxDepth: 1 })
      expect(files).toEqual([])
      const filesDeep = findFlowFiles(dir, ['.yaml'], { maxDepth: 5 })
      expect(filesDeep.length).toBe(1)
    }
    finally {
      unlinkSync(join(current, 'deep.yaml'))
    }
  })

  it('stops at maxFiles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-findFlow-'))
    writeFileSync(join(dir, 'a.yaml'), 'name: a\nsteps: []')
    writeFileSync(join(dir, 'b.yaml'), 'name: b\nsteps: []')
    writeFileSync(join(dir, 'c.yaml'), 'name: c\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'], { maxFiles: 2 })
      expect(files).toHaveLength(2)
    }
    finally {
      unlinkSync(join(dir, 'a.yaml'))
      unlinkSync(join(dir, 'b.yaml'))
      unlinkSync(join(dir, 'c.yaml'))
    }
  })
})

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

describe('executeTool', () => {
  const getConfig = createConfigLoader()
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
  })
  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('returns error when flow file does not exist', async () => {
    process.chdir(FIXTURES_DIR)
    const result = await executeTool({ flowId: 'nonexistent.yaml' }, getConfig)
    expect(result.isError).toBe(true)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/not found|File not found/)
  })

  it('runs flow and returns success when flow exists', async () => {
    process.chdir(FIXTURES_DIR)
    const result = await executeTool({ flowId: 'flow.yaml' }, getConfig)
    expect(result.isError).toBe(false)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('fixture-flow')
    expect(text).toMatch(/\*\*Success\*\*|step\(s\)/)
  })

  it('uses default config loader when getConfig omitted (cached after first load)', async () => {
    process.chdir(FIXTURES_DIR)
    const r1 = await executeTool({ flowId: 'flow.yaml' })
    const r2 = await executeTool({ flowId: 'flow.yaml' })
    expect(r1.isError).toBe(false)
    expect(r2.isError).toBe(false)
    expect(r1.content[0]?.type === 'text' ? r1.content[0].text : '').toContain('fixture-flow')
    expect(r2.content[0]?.type === 'text' ? r2.content[0].text : '').toContain('fixture-flow')
  })

  it('returns error when flow file is invalid YAML (loadFromFile returns null)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-exec-'))
    const flowPath = join(dir, 'bad.yaml')
    writeFileSync(flowPath, 'name: x\nsteps: not-an-array')
    process.chdir(dir)
    const result = await executeTool({ flowId: 'bad.yaml' }, getConfig)
    unlinkSync(flowPath)
    expect(result.isError).toBe(true)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Invalid|failed to load/)
  })

  it('returns error when openapi spec not found', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-openapi-'))
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, 'export default { openapi: { myApi: { specPath: "./missing-spec.yaml" } } }\n')
    process.chdir(dir)
    const result = await executeTool({ flowId: 'myApi-get-users' }, getConfig)
    unlinkSync(configPath)
    expect(result.isError).toBe(true)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/OpenAPI spec not found|not found/)
  })

  it('returns error when openapi operation not in generated flows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-openapi-op-'))
    const specPath = join(dir, 'openapi.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(specPath, 'openapi: "3.0.0"\ninfo: { title: T, version: "1" }\npaths:\n  /users:\n    get: {}')
    writeFileSync(configPath, 'export default { openapi: { myApi: { specPath: "./openapi.yaml" } } }\n')
    process.chdir(dir)
    const result = await executeTool({ flowId: 'myApi-get-nonexistent' }, getConfig)
    unlinkSync(specPath)
    unlinkSync(configPath)
    expect(result.isError).toBe(true)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/not found|Invalid/)
  })

  it('resolves and runs flow from openapi flowId when config has openapi', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-openapi-ok-'))
    const specPath = join(dir, 'openapi.yaml')
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(specPath, 'openapi: "3.0.0"\ninfo: { title: T, version: "1" }\npaths:\n  /users:\n    get: {}')
    writeFileSync(configPath, 'export default { openapi: { myApi: { specPath: "./openapi.yaml" } } }\n')
    process.chdir(dir)
    const result = await executeTool({ flowId: 'myApi-get-users' }, getConfig)
    unlinkSync(specPath)
    unlinkSync(configPath)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).not.toMatch(/OpenAPI spec not found|Operation .* not found/)
    expect(text).toMatch(/\*\*Success\*\*|\*\*Failed\*\*|step\(s\)|Run error|Unknown error|Step.*error/)
  })

  it('returns run error when flow execution throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-run-err-'))
    const flowPath = join(dir, 'flow.yaml')
    writeFileSync(flowPath, [
      'name: bad-flow',
      'steps:',
      '  - id: s1',
      '    type: nonexistentHandlerType',
      '    dependsOn: []',
    ].join('\n'))
    process.chdir(dir)
    const result = await executeTool({ flowId: 'flow.yaml' }, getConfig)
    unlinkSync(flowPath)
    expect(result.isError).toBe(true)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Run error|error/i)
  })
})

describe('discoverFlowListTool', () => {
  const getConfig = createConfigLoader()
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
  })
  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('returns "No flows found" when flowsDir/cwd has no yaml files', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'mcp-disc-empty-'))
    process.chdir(emptyDir)
    const result = await discoverFlowListTool({}, getConfig)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/No flows found/)
  })

  it('returns flow list as Markdown table with flowId, name', async () => {
    process.chdir(FIXTURES_DIR)
    const result = await discoverFlowListTool({}, getConfig)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).not.toMatch(/^No flows found/)
    expect(text).toContain('| flowId | name |')
    expect(text).toContain('fixture-flow')
  })

  it('uses config.flowsDir when set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-flowsDir-'))
    const flowsSub = join(dir, 'flows')
    mkdirSync(flowsSub, { recursive: true })
    const configPath = join(dir, 'runflow.config.mjs')
    const flowPath = join(flowsSub, 'flow.yaml')
    writeFileSync(configPath, 'export default { flowsDir: "flows" }\n')
    writeFileSync(flowPath, 'name: flows-dir-flow\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({}, getConfig)
    unlinkSync(configPath)
    unlinkSync(flowPath)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('flows-dir-flow')
  })

  it('respects limit parameter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-limit-'))
    writeFileSync(join(dir, 'a.yaml'), 'name: flow-a\nsteps: []')
    writeFileSync(join(dir, 'b.yaml'), 'name: flow-b\nsteps: []')
    writeFileSync(join(dir, 'c.yaml'), 'name: flow-c\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({ limit: 2 }, getConfig)
    unlinkSync(join(dir, 'a.yaml'))
    unlinkSync(join(dir, 'b.yaml'))
    unlinkSync(join(dir, 'c.yaml'))
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Total: 3 flows\. Showing 1-2\./)
    const tableRows = text.split('\n').filter(line => line.startsWith('|') && !line.includes('flowId') && !line.includes('---'))
    expect(tableRows).toHaveLength(2)
  })

  it('returns total count and respects offset for pagination', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-offset-'))
    writeFileSync(join(dir, 'a.yaml'), 'name: flow-a\nsteps: []')
    writeFileSync(join(dir, 'b.yaml'), 'name: flow-b\nsteps: []')
    writeFileSync(join(dir, 'c.yaml'), 'name: flow-c\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({ limit: 2, offset: 1 }, getConfig)
    unlinkSync(join(dir, 'a.yaml'))
    unlinkSync(join(dir, 'b.yaml'))
    unlinkSync(join(dir, 'c.yaml'))
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Total: 3 flows\. Showing 2-3\./)
    expect(text).toContain('flow-b')
    expect(text).toContain('flow-c')
    expect(text).not.toContain('flow-a')
  })

  it('when offset beyond length returns total and range message', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-offset-over-'))
    writeFileSync(join(dir, 'a.yaml'), 'name: flow-a\nsteps: []')
    writeFileSync(join(dir, 'b.yaml'), 'name: flow-b\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({ limit: 10, offset: 10 }, getConfig)
    unlinkSync(join(dir, 'a.yaml'))
    unlinkSync(join(dir, 'b.yaml'))
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Total: 2 flows\. No flows in this range \(offset 10\)\./)
  })

  it('includes pagination hint when more results exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-pagination-'))
    writeFileSync(join(dir, 'a.yaml'), 'name: flow-a\nsteps: []')
    writeFileSync(join(dir, 'b.yaml'), 'name: flow-b\nsteps: []')
    writeFileSync(join(dir, 'c.yaml'), 'name: flow-c\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({ limit: 2 }, getConfig)
    unlinkSync(join(dir, 'a.yaml'))
    unlinkSync(join(dir, 'b.yaml'))
    unlinkSync(join(dir, 'c.yaml'))
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Next: offset=2/)
  })

  it('filters by keyword (file name, name, or description, case-insensitive)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-kw-'))
    writeFileSync(join(dir, 'match.yaml'), 'name: Hello World\nsteps: []')
    writeFileSync(join(dir, 'nomatch.yaml'), 'name: Other\nsteps: []')
    writeFileSync(join(dir, 'desc.yaml'), 'name: x\ndescription: Secret KEYWORD here\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({ keyword: 'world' }, getConfig)
    let text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('Hello World')
    const result2 = await discoverFlowListTool({ keyword: 'KEYWORD' }, getConfig)
    text = result2.content[0]?.type === 'text' ? result2.content[0].text : ''
    expect(text).toContain('x')
    unlinkSync(join(dir, 'match.yaml'))
    unlinkSync(join(dir, 'nomatch.yaml'))
    unlinkSync(join(dir, 'desc.yaml'))
  })

  it('filters by keyword matching file name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-fname-'))
    writeFileSync(join(dir, 'hello-flow.yaml'), 'name: Other\nsteps: []')
    writeFileSync(join(dir, 'other.yaml'), 'name: Other\nsteps: []')
    process.chdir(dir)
    const result = await discoverFlowListTool({ keyword: 'hello-flow' }, getConfig)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('hello-flow')
    expect(text).toContain('Other')
    unlinkSync(join(dir, 'hello-flow.yaml'))
    unlinkSync(join(dir, 'other.yaml'))
  })
})

describe('discoverFlowDetailTool', () => {
  const getConfig = createConfigLoader()
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
  })
  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('returns flow detail with name, description, params when flow exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-disc-detail-'))
    writeFileSync(join(dir, 'with-params.yaml'), [
      'name: flow-with-params',
      'params:',
      '  - name: id',
      '    type: string',
      '    required: true',
      '  - name: count',
      '    type: number',
      'steps: []',
    ].join('\n'))
    process.chdir(dir)
    const result = await discoverFlowDetailTool({ flowId: 'with-params.yaml' }, getConfig)
    unlinkSync(join(dir, 'with-params.yaml'))
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('- **flowId**:')
    expect(text).toContain('flow-with-params')
    expect(text).toMatch(/\*\*id\*\* \(string.*required\)|\*\*count\*\* \(number\)/)
    expect(result.isError).not.toBe(true)
  })

  it('returns error when flowId not in catalog', async () => {
    process.chdir(FIXTURES_DIR)
    const result = await discoverFlowDetailTool({ flowId: 'nonexistent-flow-id' }, getConfig)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Flow not found/)
    expect(text).toContain('nonexistent-flow-id')
    expect(result.isError).toBe(true)
  })
})
