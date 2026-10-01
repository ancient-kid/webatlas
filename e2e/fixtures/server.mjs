// Tiny static server for E2E fixture pages, so capture tests never need the internet.
// Started by playwright.config.ts (webServer). Usage: node e2e/fixtures/server.mjs [port]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'site')
const port = Number(process.argv[2] ?? process.env.WA_FIXTURE_PORT ?? 4599)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/svg+xml'
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  const rel = normalize(path === '/' ? '/article.html' : path).replace(/^([/\\])+/, '')
  if (rel.startsWith('..')) {
    res.writeHead(400).end('bad path')
    return
  }
  try {
    const body = await readFile(join(root, rel))
    res.writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`[fixtures] serving ${root} on http://127.0.0.1:${port}`)
})
