import fs from 'node:fs'
import path from 'node:path'
import { createServer as createViteServer } from 'vite'

export async function createViteMiddleware(appDir: string) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
    root: appDir,
  })

  return async (req: any, res: any, next: any) => {
    // Let Vite handle the request
    vite.middlewares(req, res, async () => {
      if (res.writableEnded)
        return next()

      const url = req.url
      try {
        const template = fs.readFileSync(path.resolve(appDir, 'index.html'), 'utf-8')
        const html = await vite.transformIndexHtml(url, template)
        res.setHeader('Content-Type', 'text/html')
        res.end(html)
      }
      catch (e) {
        vite.ssrFixStacktrace(e as Error)
        next(e)
      }
    })
  }
}
