import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * Custom dev/preview server: Express + Vite middleware mode.
 * Workspace API (/api/workspace/*) is served here instead of via Vite plugin,
 * so vite.config.ts does not need to import @runflow/workspace.
 * @see https://vite.dev/guide/ssr
 */
import express from 'express'
import { createServer as createViteServer, loadEnv } from 'vite'
import { createWorkspaceApiMiddleware } from './workspace-api'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(__dirname, '../../..')
const isProd = process.env.NODE_ENV === 'production'

const mode = process.env.MODE ?? 'development'
Object.assign(process.env, loadEnv(mode, rootDir, ''))

async function start() {
  const app = express()

  // Workspace API first so /api/workspace/* is handled before Vite
  app.use(createWorkspaceApiMiddleware())

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
    app.use('/{*splat}', async (req, res, next) => {
      const url = req.originalUrl
      try {
        let template = fs.readFileSync(path.resolve(appDir, 'index.html'), 'utf-8')
        template = await vite.transformIndexHtml(url, template)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
      }
      catch (e) {
        vite.ssrFixStacktrace(e as Error)
        next(e)
      }
    })
  }
  else {
    app.use(express.static(path.resolve(appDir, 'dist')))
    app.use('/{*splat}', (_req, res) => {
      res.sendFile(path.resolve(appDir, 'dist/index.html'))
    })
  }

  const port = 5173
  app.listen(port, () => {
    // eslint-disable-next-line no-console -- dev server startup hint
    console.log(`  ➜  Local:   http://localhost:${port}/`)
  })
}

start().catch((e) => {
  console.error(e)
  process.exit(1)
})
