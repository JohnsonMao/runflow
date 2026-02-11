import type { OpenApiToFlowsResult } from './types.js'
import { mkdtempSync, readdirSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeFlowsToDir } from './writeFlows.js'

function minimalFlow(name: string) {
  return {
    name,
    steps: [{ id: 's1', type: 'set' as const, set: {}, dependsOn: [] }],
  }
}

describe('writeFlowsToDir', () => {
  it('creates output dir and writes one YAML file per flow with safe filenames', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writeFlows-'))
    const result: OpenApiToFlowsResult = new Map([
      ['get-users', minimalFlow('GetUsers')],
      ['POST /items', minimalFlow('PostItems')],
    ])
    await writeFlowsToDir(result, dir)
    const files = readdirSync(dir).sort()
    expect(files).toEqual(['POST--items.yaml', 'get-users.yaml'])
    const getUsers = readFileSync(join(dir, 'get-users.yaml'), 'utf-8')
    expect(getUsers).toContain('name:')
    expect(getUsers).toContain('steps:')
    const postItems = readFileSync(join(dir, 'POST--items.yaml'), 'utf-8')
    expect(postItems).toContain('name:')
    files.forEach(f => unlinkSync(join(dir, f)))
    rmdirSync(dir)
  })

  it('uses recursive mkdir when output dir does not exist', async () => {
    const base = mkdtempSync(join(tmpdir(), 'writeFlows-'))
    const nested = join(base, 'a', 'b', 'c')
    const result: OpenApiToFlowsResult = new Map([['op', minimalFlow('Op')]])
    await writeFlowsToDir(result, nested)
    const files = readdirSync(nested)
    expect(files).toEqual(['op.yaml'])
    unlinkSync(join(nested, 'op.yaml'))
    rmdirSync(nested)
    rmdirSync(join(base, 'a', 'b'))
    rmdirSync(join(base, 'a'))
    rmdirSync(base)
  })

  it('sanitizes key to filename: spaces and slashes to hyphen, non-word chars removed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writeFlows-'))
    const result: OpenApiToFlowsResult = new Map([
      ['GET /users', minimalFlow('GetUsers')],
      ['  x/y  ', minimalFlow('X')],
    ])
    await writeFlowsToDir(result, dir)
    const files = readdirSync(dir).sort()
    expect(files).toContain('GET--users.yaml')
    expect(files).toContain('-x-y-.yaml')
    files.forEach(f => unlinkSync(join(dir, f)))
    rmdirSync(dir)
  })

  it('writes flow.yaml when key becomes empty after sanitization', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writeFlows-'))
    const result: OpenApiToFlowsResult = new Map([
      ['!!!@@@', minimalFlow('Fallback')],
    ])
    await writeFlowsToDir(result, dir)
    const files = readdirSync(dir)
    expect(files).toEqual(['flow.yaml'])
    const content = readFileSync(join(dir, 'flow.yaml'), 'utf-8')
    expect(content).toContain('Fallback')
    unlinkSync(join(dir, 'flow.yaml'))
    rmdirSync(dir)
  })

  it('writes nothing when result is empty but creates dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writeFlows-'))
    const result: OpenApiToFlowsResult = new Map()
    await writeFlowsToDir(result, dir)
    const files = readdirSync(dir)
    expect(files).toEqual([])
    rmdirSync(dir)
  })
})
