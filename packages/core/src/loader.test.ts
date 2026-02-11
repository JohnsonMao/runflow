import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadFromFile } from './loader'

describe('loadFromFile', () => {
  it('returns FlowDefinition when file exists and contains valid flow YAML', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runflow-loader-'))
    try {
      const file = join(dir, 'flow.yaml')
      const yaml = [
        'name: test',
        'steps:',
        '  - id: s1',
        '    type: set',
        '    set: {}',
      ].join('\n')
      writeFileSync(file, yaml, 'utf-8')
      const flow = loadFromFile(file)
      expect(flow).not.toBeNull()
      expect(flow?.name).toBe('test')
      expect(flow?.steps).toHaveLength(1)
      expect(flow?.steps[0].id).toBe('s1')
    }
    finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('returns null when file does not exist and does not throw', () => {
    const result = loadFromFile('/nonexistent/path/flow.yaml')
    expect(result).toBeNull()
  })

  it('returns null when file content is invalid flow (invalid YAML) and does not throw', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runflow-loader-'))
    try {
      const file = join(dir, 'bad.yaml')
      writeFileSync(file, 'not: valid: yaml:', 'utf-8')
      const result = loadFromFile(file)
      expect(result).toBeNull()
    }
    finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('returns null when file content is valid YAML but missing required flow fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runflow-loader-'))
    try {
      const file = join(dir, 'no-name.yaml')
      const yaml = [
        'steps:',
        '  - id: s1',
        '    type: set',
        '    set: {}',
      ].join('\n')
      writeFileSync(file, yaml, 'utf-8')
      const result = loadFromFile(file)
      expect(result).toBeNull()
    }
    finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('loads flow with camelCase step keys (dependsOn)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runflow-loader-'))
    try {
      const file = join(dir, 'flow.yaml')
      const yaml = [
        'name: dag-flow',
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
      writeFileSync(file, yaml, 'utf-8')
      const flow = loadFromFile(file)
      expect(flow).not.toBeNull()
      expect(flow?.name).toBe('dag-flow')
      expect(flow?.steps).toHaveLength(2)
      expect(flow?.steps[0].dependsOn).toEqual([])
      expect(flow?.steps[1].dependsOn).toEqual(['a'])
    }
    finally {
      rmSync(dir, { recursive: true })
    }
  })
})
