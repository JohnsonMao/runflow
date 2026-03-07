/**
 * Shared test helper for CLI tests. Run program.parseAsync with mocked process.exit, stdout, stderr, console.
 */
import { vi } from 'vitest'

const EXIT_CODE_SENTINEL = 'CLI_EXIT:'

export async function runWithParse(
  args: string[],
  cwd?: string,
): Promise<{ code: number, stdout: string, stderr: string }> {
  vi.resetModules()
  const { program } = await import('./cli.js')
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const exitMock = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`${EXIT_CODE_SENTINEL}${code ?? 0}`)
  })
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk))
    return true
  })
  const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk))
    return true
  })
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    const msg = a.map(String).join(' ')
    stderrChunks.push(stderrChunks.length > 0 ? `\n${msg}` : msg)
  })
  const consoleLog = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    const msg = a.map(String).join(' ')
    stdoutChunks.push(stdoutChunks.length > 0 ? `\n${msg}` : msg)
  })
  const origCwd = process.cwd()
  if (cwd)
    process.chdir(cwd)
  try {
    await program.parseAsync(['node', 'flow', ...args])
    return { code: 0, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith(EXIT_CODE_SENTINEL)) {
      const code = Number.parseInt(msg.slice(EXIT_CODE_SENTINEL.length), 10) || 0
      return { code, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
    }
    throw e
  }
  finally {
    exitMock.mockRestore()
    stdoutWrite.mockRestore()
    stderrWrite.mockRestore()
    consoleError.mockRestore()
    consoleLog.mockRestore()
    if (cwd)
      process.chdir(origCwd)
  }
}
