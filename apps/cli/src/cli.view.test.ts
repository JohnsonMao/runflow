import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runWithParse } from './cli.test-utils.js'

describe('flow view', () => {
  it('exits 1 when flow is not found', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-view-'))
    const result = await runWithParse(['view', 'nonexistent.yaml'], dir)
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Error|not found|File not found/i)
  })

  it('default output is Mermaid (flowchart TB, nodes and edges)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-view-'))
    const flowPath = join(dir, 'linear.yaml')
    const yaml = [
      'name: linear',
      'steps:',
      '  - id: a',
      '    type: set',
      '    set: {}',
      '    dependsOn: []',
      '  - id: b',
      '    type: set',
      '    set: {}',
      '    dependsOn: [a]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['view', 'linear.yaml'], dir)
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('flowchart TB')
    expect(result.stdout).toContain('["a (set)"]')
    expect(result.stdout).toContain('["b (set)"]')
    expect(result.stdout).toMatch(/a\s*-->\s*b/)
  })

  it('--output json outputs flow-graph-format JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-view-'))
    const flowPath = join(dir, 'two.yaml')
    const yaml = [
      'name: two-step',
      'steps:',
      '  - id: fetch',
      '    type: http',
      '    url: https://example.com',
      '    dependsOn: []',
      '  - id: done',
      '    type: set',
      '    set: {}',
      '    dependsOn: [fetch]',
    ].join('\n')
    writeFileSync(flowPath, yaml)
    const result = await runWithParse(['view', 'two.yaml', '--output', 'json'], dir)
    unlinkSync(flowPath)
    expect(result.code).toBe(0)
    const data = JSON.parse(result.stdout) as { nodes: { id: string }[], edges: { source: string, target: string }[], flowName?: string }
    expect(data.nodes).toHaveLength(2)
    expect(data.nodes.map(n => n.id)).toContain('fetch')
    expect(data.nodes.map(n => n.id)).toContain('done')
    expect(data.edges).toHaveLength(1)
    expect(data.edges[0]).toEqual({ source: 'fetch', target: 'done' })
    expect(data.flowName).toBe('two-step')
  })
})
