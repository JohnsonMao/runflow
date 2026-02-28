// @env node
import type { DiscoverEntry } from '@runflow/workspace'
import type { ConfigAndRegistry } from './tools.js'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createBuiltinRegistry } from '@runflow/handlers'
import {
  buildDiscoverCatalog,
  buildRegistryFromConfig,
  findConfigFile,
  isDevelopment,
  loadConfig,
} from '@runflow/workspace'
import { createCommand } from 'commander'
import { registerTools } from './tools.js'

const program = createCommand()
program
  .name('runflow-mcp')
  .version('0.0.0')
  .option('-c, --config <path>', 'Path to runflow config file')
  .parse(process.argv)

const server = new McpServer({
  name: 'runflow',
  version: '0.0.0',
})

/** Performs one config load from current cwd (no cache). Useful when cwd or config location may change. */
export async function loadConfigOnce(): Promise<ConfigAndRegistry> {
  const cwd = process.cwd()
  const cliConfig = program.opts().config
  const configPath = cliConfig != null
    ? path.resolve(cwd, cliConfig)
    : findConfigFile(cwd)
  const config = configPath ? await loadConfig(configPath) : null
  const configDir = configPath ? path.dirname(configPath) : cwd
  const registry = config && configPath ? await buildRegistryFromConfig(config, configDir) : createBuiltinRegistry()
  return { config, configDir, registry }
}

let cachedConfig: ConfigAndRegistry | null = null
let loadPromise: Promise<ConfigAndRegistry> | null = null

function getConfigAndRegistry(): Promise<ConfigAndRegistry> {
  if (isDevelopment())
    return loadConfigOnce()
  if (cachedConfig)
    return Promise.resolve(cachedConfig)
  if (!loadPromise) {
    loadPromise = loadConfigOnce().then((r) => {
      cachedConfig = r
      return r
    })
  }
  return loadPromise
}

let cachedCatalog: DiscoverEntry[] | null = null
let catalogConfigSnapshot: { configDir: string, cwd: string } | null = null

/** Catalog getter with no args; used by tools (bound to getConfigAndRegistry). */
async function getDiscoverCatalog(): Promise<DiscoverEntry[]> {
  const { config, configDir } = await getConfigAndRegistry()
  const cwd = process.cwd()
  if (!isDevelopment() && cachedCatalog != null && catalogConfigSnapshot?.configDir === configDir && catalogConfigSnapshot?.cwd === cwd)
    return cachedCatalog
  const catalog = await buildDiscoverCatalog(config, configDir, cwd)
  cachedCatalog = catalog
  catalogConfigSnapshot = { configDir, cwd }
  return catalog
}

registerTools(server, getConfigAndRegistry, getDiscoverCatalog)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
void main()
