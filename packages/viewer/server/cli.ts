import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startViewerServer } from './app'

const isProd = process.env.NODE_ENV === 'production'

async function run() {
  const port = 5173
  const viewerServer = await startViewerServer({
    port,
    enableViteDev: !isProd,
  })

  console.log(`[Viewer] WebSocket server ready at ws://localhost:${port}`)

  process.on('SIGINT', () => {
    viewerServer.close().catch(() => {})
    process.exit()
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
