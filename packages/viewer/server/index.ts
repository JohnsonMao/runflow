import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startViewerServer } from './lib/index'

const isProd = process.env.NODE_ENV === 'production'

async function run() {
  await startViewerServer({
    port: 5173,
    enableViteDev: !isProd,
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
