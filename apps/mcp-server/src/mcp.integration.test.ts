/**
 * Integration tests: connect to MCP server over stdio via StdioClientTransport and call tools.
 * Requires server to be built (pnpm build). Skips when dist/index.js is missing.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { existsSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMcpClient, FIXTURES_DIR, SERVER_DIST_PATH } from './fixtures'

const serverBuilt = existsSync(SERVER_DIST_PATH)

function getTextContent(response: CallToolResult): string {
  const first = response.content[0]
  return first?.type === 'text' ? first.text : ''
}

describe('mcp over stdio (integration)', () => {
  let client: Awaited<ReturnType<typeof createMcpClient>>

  beforeEach(async () => {
    if (!serverBuilt)
      return
    client = await createMcpClient(FIXTURES_DIR)
  })

  afterEach(async () => {
    if (client)
      await client.close()
  })

  it.skipIf(!serverBuilt)('executor_flow tool runs flow via client.callTool', async () => {
    const response = await client!.callTool({
      name: 'executor_flow',
      arguments: { flowId: 'flow.yaml' },
    }) as CallToolResult
    expect(response.isError).toBe(false)
    const text = getTextContent(response)
    expect(text).toContain('fixture-flow')
    expect(text).toMatch(/\*\*Success\*\*|step\(s\)/)
  })

  it.skipIf(!serverBuilt)('executor_flow tool returns error when flow file not found', async () => {
    const response = await client!.callTool({
      name: 'executor_flow',
      arguments: { flowId: 'nonexistent.yaml' },
    }) as CallToolResult
    expect(response.isError).toBe(true)
    const text = getTextContent(response)
    expect(text).toMatch(/not found|File not found/)
  })

  it.skipIf(!serverBuilt)('discover_flow_list tool lists flows via client.callTool', async () => {
    const response = await client!.callTool({
      name: 'discover_flow_list',
      arguments: {},
    }) as CallToolResult
    const text = getTextContent(response)
    expect(text).not.toMatch(/^No flows found/)
    expect(text).toContain('| flowId | name |')
    expect(text).toContain('fixture-flow')
  })
})
