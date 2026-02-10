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
      writeFileSync(file, 'name: test\nsteps:\n  - id: s1\n    type: set\n    set: {}\n', 'utf-8')
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
      writeFileSync(file, 'steps:\n  - id: s1\n    type: set\n    set: {}\n', 'utf-8')
      const result = loadFromFile(file)
      expect(result).toBeNull()
    }
    finally {
      rmSync(dir, { recursive: true })
    }
  })
})
