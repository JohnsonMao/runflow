import { mkdirSync, mkdtempSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findFlowFiles } from './discover'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('findFlowFiles', () => {
  it('returns empty array when path does not exist', () => {
    const files = findFlowFiles(path.join(__dirname, 'nonexistent-dir-xyz'), ['.yaml'])
    expect(files).toEqual([])
  })

  it('returns empty array when path is a file (not a directory)', () => {
    const files = findFlowFiles(path.join(__dirname, 'discover.test.ts'), ['.yaml'])
    expect(files).toEqual([])
  })

  it('finds yaml files in directory', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-dir-'))
    const flowPath = path.join(dir, 'flow.yaml')
    writeFileSync(flowPath, 'name: x\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'])
      expect(files).toHaveLength(1)
      expect(files[0]).toBe(flowPath)
    }
    finally {
      unlinkSync(flowPath)
    }
  })

  it('finds yaml files recursively in subdirectories', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-recursive-'))
    const subDir = path.join(dir, 'sub')
    const nodeModulesDir = path.join(dir, 'node_modules')
    mkdirSync(subDir, { recursive: true })
    mkdirSync(nodeModulesDir, { recursive: true })
    const flowPath = path.join(subDir, 'nested.yaml')
    writeFileSync(flowPath, 'name: nested\nsteps: []')
    writeFileSync(path.join(dir, 'root.yaml'), 'name: root\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'])
      expect(files).toContain(flowPath)
      expect(files).toContain(path.join(dir, 'root.yaml'))
      expect(files.some(f => f.includes('node_modules'))).toBe(false)
    }
    finally {
      unlinkSync(flowPath)
      unlinkSync(path.join(dir, 'root.yaml'))
    }
  })

  it('returns [] when allowedRoot is set and baseDir is outside', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-allowedRoot-'))
    writeFileSync(path.join(dir, 'flow.yaml'), 'name: x\nsteps: []')
    const otherRoot = path.join(tmpdir(), 'other-root-xyz')
    mkdirSync(otherRoot, { recursive: true })
    try {
      const files = findFlowFiles(dir, ['.yaml'], { allowedRoot: otherRoot })
      expect(files).toEqual([])
    }
    finally {
      unlinkSync(path.join(dir, 'flow.yaml'))
    }
  })

  it('returns [] when baseDir is a symlink', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-symlink-dir-'))
    const linkPath = path.join(tmpdir(), 'findFlowFiles-symlink-dir-link')
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
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-symlink-file-'))
    const realPath = path.join(dir, 'real.yaml')
    writeFileSync(realPath, 'name: real\nsteps: []')
    const linkPath = path.join(dir, 'link.yaml')
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
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-maxDepth-'))
    let current = dir
    for (let i = 0; i < 5; i++) {
      current = path.join(current, 'sub')
      mkdirSync(current, { recursive: true })
    }
    writeFileSync(path.join(current, 'deep.yaml'), 'name: deep\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'], { maxDepth: 1 })
      expect(files).toEqual([])
      const filesDeep = findFlowFiles(dir, ['.yaml'], { maxDepth: 5 })
      expect(filesDeep.length).toBe(1)
    }
    finally {
      unlinkSync(path.join(current, 'deep.yaml'))
    }
  })

  it('stops at maxFiles', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'findFlowFiles-maxFiles-'))
    writeFileSync(path.join(dir, 'a.yaml'), 'name: a\nsteps: []')
    writeFileSync(path.join(dir, 'b.yaml'), 'name: b\nsteps: []')
    writeFileSync(path.join(dir, 'c.yaml'), 'name: c\nsteps: []')
    try {
      const files = findFlowFiles(dir, ['.yaml'], { maxFiles: 2 })
      expect(files).toHaveLength(2)
    }
    finally {
      unlinkSync(path.join(dir, 'a.yaml'))
      unlinkSync(path.join(dir, 'b.yaml'))
      unlinkSync(path.join(dir, 'c.yaml'))
    }
  })
})
