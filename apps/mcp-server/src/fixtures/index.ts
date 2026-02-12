/**
 * Fixtures for MCP integration tests: spawn server via StdioClientTransport and connect with Client.
 * Pattern inspired by playwright-mcp tests:
 * https://github.com/microsoft/playwright-mcp/blob/main/packages/playwright-mcp/tests/fixtures.ts
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Path to built server entry (apps/mcp-server/dist/index.js). */
export const SERVER_DIST_PATH = join(__dirname, '../../dist/index.js')

/** Path to this app's fixtures (apps/mcp-server/src/fixtures), contains flow.yaml for integration tests. */
export const FIXTURES_DIR = __dirname

/**
 * Create an MCP client connected to the runflow MCP server over stdio.
 * Spawns `node dist/index.js` with the given cwd so config and flow resolution use that directory.
 * @param cwd - Working directory for the server process (default: FIXTURES_DIR)
 * @returns Connected client; call client.close() when done.
 */
export async function createMcpClient(cwd: string = FIXTURES_DIR): Promise<Client> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_DIST_PATH],
    cwd,
    stderr: 'pipe',
  })
  const client = new Client(
    { name: 'runflow-mcp-test', version: '1.0.0' },
  )
  await client.connect(transport)
  return client
}

/** Skip integration tests when server dist is not built (e.g. run unit tests only). */
export function skipIfServerNotBuilt(): void {
  if (!existsSync(SERVER_DIST_PATH))
    throw new Error('Server not built: run pnpm build before integration tests')
}
