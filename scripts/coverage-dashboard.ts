/**
 * Generate a root coverage dashboard that links to each workspace package's
 * coverage/index.html. Run after `pnpm test:coverage`.
 * Usage: pnpm coverage:report   or   pnpm coverage:open (adds --open)
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const appsDir = path.join(root, 'apps')
const packagesDir = path.join(root, 'packages')

interface ReportEntry {
  name: string
  path: string
}

function findCoverageReports(): ReportEntry[] {
  const entries: ReportEntry[] = []
  for (const dir of [appsDir, packagesDir]) {
    if (!existsSync(dir))
      continue
    for (const name of readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)) {
      const indexPath = path.join(dir, name, 'coverage', 'index.html')
      if (existsSync(indexPath)) {
        const rel = path.join(dir === appsDir ? 'apps' : 'packages', name, 'coverage', 'index.html')
        entries.push({ name: dir === appsDir ? `apps/${name}` : `packages/${name}`, path: rel })
      }
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

const reports = findCoverageReports()
const outDir = path.join(root, 'coverage')
mkdirSync(outDir, { recursive: true })

const reportsWithHref = reports.map(r => ({
  name: r.name,
  path: path.relative(outDir, path.join(root, r.path)),
}))

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coverage · Turborepo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.5rem; }
    ul { list-style: none; padding: 0; }
    li { margin: 0.5rem 0; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    p { color: #656d76; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>Test coverage</h1>
  <p>Run <code>pnpm test:coverage</code> to generate reports. Click a package to open its HTML report.</p>
  <ul>
${reportsWithHref.map(r => `    <li><a href="${r.path}">${r.name}</a></li>`).join('\n')}
  </ul>
  ${reports.length === 0 ? '<p>No coverage reports found. Run <code>pnpm test:coverage</code> first.</p>' : ''}
</body>
</html>
`

const indexPath = path.join(outDir, 'index.html')
writeFileSync(indexPath, html, 'utf-8')
console.log('Coverage dashboard written to coverage/index.html')

const shouldOpen = process.argv.includes('--open')
if (shouldOpen && reports.length > 0) {
  let openCmd = 'xdg-open'
  if (process.platform === 'darwin')
    openCmd = 'open'
  else if (process.platform === 'win32')
    openCmd = 'start'
  try {
    execSync(`${openCmd} "${indexPath}"`, { stdio: 'inherit' })
  }
  catch {
    console.log('Open manually:', indexPath)
  }
}
else if (reports.length === 0) {
  console.log('No package coverage found. Run pnpm test:coverage first.')
}
