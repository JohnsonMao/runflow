import type { GetConfigAndRegistry } from './tools'
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDiscoverCatalog } from '@runflow/workspace'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIXTURES_DIR } from './fixtures'
import { loadConfigOnce } from './index'
import {
  discoverFlowDetailTool,
  discoverFlowListTool,
  executeTool,
  formatRunResult,
} from './tools'

/** Build a no-arg getDiscoverCatalog that uses the given getConfig (for tests). */
function createGetDiscoverCatalog(getConfig: GetConfigAndRegistry) {
  return async () => {
    const { config, configDir } = await getConfig()
    return buildDiscoverCatalog(config, configDir, process.cwd())
  }
}

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

describe('executeTool', () => {
  const getConfig = () => loadConfigOnce()
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

  it('flow step can call another flow by workspace path when resolveFlow is passed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-flow-step-ws-'))
    const flowsDir = join(dir, 'flows')
    mkdirSync(flowsDir, { recursive: true })
    const configPath = join(dir, 'runflow.config.mjs')
    writeFileSync(configPath, 'export default { flowsDir: "flows" }\n')
    const mainPath = join(flowsDir, 'main.yaml')
    const subPath = join(flowsDir, 'sub.yaml')
    writeFileSync(mainPath, [
      'name: main-flow',
      'steps:',
      '  - id: call',
      '    type: flow',
      '    flow: sub.yaml',
      '    dependsOn: []',
    ].join('\n'))
    writeFileSync(subPath, [
      'name: sub-flow',
      'steps:',
      '  - id: s1',
      '    type: set',
      '    set: { x: 1 }',
      '    dependsOn: []',
    ].join('\n'))
    process.chdir(dir)
    const result = await executeTool({ flowId: 'main.yaml' }, getConfig)
    unlinkSync(configPath)
    unlinkSync(mainPath)
    unlinkSync(subPath)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(result.isError).toBe(false)
    expect(text).toMatch(/\*\*Success\*\*|main-flow|step\(s\)/)
    expect(text).toMatch(/call\.s1|call/)
  })
})

describe('discoverFlowListTool', () => {
  const getConfig = () => loadConfigOnce()
  const getDiscoverCatalog = createGetDiscoverCatalog(getConfig)
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
    const result = await discoverFlowListTool({}, getDiscoverCatalog)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/No flows found/)
  })

  it('returns flow list as Markdown table with flowId, name', async () => {
    process.chdir(FIXTURES_DIR)
    const result = await discoverFlowListTool({}, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({}, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({ limit: 2 }, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({ limit: 2, offset: 1 }, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({ limit: 10, offset: 10 }, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({ limit: 2 }, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({ keyword: 'world' }, getDiscoverCatalog)
    let text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('Hello World')
    const result2 = await discoverFlowListTool({ keyword: 'KEYWORD' }, getDiscoverCatalog)
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
    const result = await discoverFlowListTool({ keyword: 'hello-flow' }, getDiscoverCatalog)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('hello-flow')
    expect(text).toContain('Other')
    unlinkSync(join(dir, 'hello-flow.yaml'))
    unlinkSync(join(dir, 'other.yaml'))
  })
})

describe('discoverFlowDetailTool', () => {
  const getConfig = () => loadConfigOnce()
  const getDiscoverCatalog = createGetDiscoverCatalog(getConfig)
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
    const result = await discoverFlowDetailTool({ flowId: 'with-params.yaml' }, getDiscoverCatalog)
    unlinkSync(join(dir, 'with-params.yaml'))
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('- **flowId**:')
    expect(text).toContain('flow-with-params')
    expect(text).toMatch(/\*\*id\*\* \(string.*required\)|\*\*count\*\* \(number\)/)
    expect(result.isError).not.toBe(true)
  })

  it('returns error when flowId not in catalog', async () => {
    process.chdir(FIXTURES_DIR)
    const result = await discoverFlowDetailTool({ flowId: 'nonexistent-flow-id' }, getDiscoverCatalog)
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toMatch(/Flow not found/)
    expect(text).toContain('nonexistent-flow-id')
    expect(result.isError).toBe(true)
  })
})
