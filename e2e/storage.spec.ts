import { expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TINY_PNG_DATA_URL } from '../src/shared/testing/factories'
import type { Workspace } from '../src/shared/types'
import { launchApp, type LaunchedApp } from './helpers/launch'

const SECRETS = { ANTHROPIC_API_KEY: 'sk-ant-e2e-SECRET-111', GROQ_API_KEY: 'gsk-e2e-SECRET-222' }

let launched: LaunchedApp
test.afterEach(async () => {
  await launched?.close()
})

const createWs = (l: LaunchedApp, name: string): Promise<Workspace> =>
  l.page.evaluate((n) => window.api.workspace.create({ name: n, researchQuestion: 'Why?' }), name)

/** Every file under a folder, recursively. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

test('window.api exposes exactly the documented groups', async () => {
  launched = await launchApp()
  const keys = await launched.page.evaluate(() => Object.keys(window.api).sort())
  expect(keys).toEqual(['ai', 'app', 'export', 'import', 'on', 'thumb', 'workspace'])
})

test('create → list → the file is on disk', async () => {
  launched = await launchApp()
  const ws = await createWs(launched, 'Test one')
  expect(Object.values(ws.board.nodes)).toEqual([
    expect.objectContaining({ kind: 'question', title: 'Why?' })
  ])
  const list = await launched.page.evaluate(() => window.api.workspace.list())
  expect(list).toEqual([expect.objectContaining({ id: ws.id, name: 'Test one', nodeCount: 0 })])
  const file = join(launched.userData, 'workspaces', ws.id, 'workspace.json')
  expect(JSON.parse(readFileSync(file, 'utf8')).name).toBe('Test one')
  expect(existsSync(join(launched.userData, 'workspaces', 'index.json'))).toBe(true)
})

test('duplicate and delete through window.api', async () => {
  launched = await launchApp()
  const ws = await createWs(launched, 'Original')
  const copy = await launched.page.evaluate((id) => window.api.workspace.duplicate(id), ws.id)
  expect(copy.name).toBe('Original (copy)')
  await launched.page.evaluate((id) => window.api.workspace.delete(id), copy.id)
  const names = await launched.page.evaluate(async () =>
    (await window.api.workspace.list()).map((w) => w.name)
  )
  expect(names).toEqual(['Original'])
  expect(existsSync(join(launched.userData, 'workspaces', copy.id))).toBe(false)
})

test('a saved thumbnail is served over wa-thumb://', async () => {
  launched = await launchApp()
  const ws = await createWs(launched, 'Thumbs')
  const result = await launched.page.evaluate(
    async ({ id, png }) => {
      const url = await window.api.thumb.save(id, 'card-1', png)
      const res = await fetch(url)
      return {
        url,
        status: res.status,
        type: res.headers.get('content-type'),
        bytes: (await res.arrayBuffer()).byteLength
      }
    },
    { id: ws.id, png: TINY_PNG_DATA_URL }
  )
  expect(result.url).toMatch(new RegExp(`^wa-thumb://${ws.id}/card-1\\.png\\?v=\\d+$`))
  expect(result).toMatchObject({ status: 200, type: 'image/png' })
  expect(result.bytes).toBeGreaterThan(50)
})

test('a wa-thumb:// URL that tries to escape the workspaces folder fails', async () => {
  launched = await launchApp()
  const outcome = await launched.page.evaluate(async () => {
    try {
      const res = await fetch('wa-thumb://../../x')
      return res.ok ? 'ok' : `status ${res.status}`
    } catch {
      return 'network error'
    }
  })
  expect(outcome).not.toBe('ok')
})

test('a save sent just before closing is on disk after relaunch (close flush)', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  try {
    launched = await launchApp({ userData })
    const ws = await createWs(launched, 'Before close')
    // Fire the save without waiting for it, then close immediately.
    await launched.page.evaluate((w) => {
      void window.api.workspace.save({ ...w, name: 'Saved at close' })
    }, ws)
    const started = Date.now()
    await launched.app.close()
    // The renderer answered the handshake, so main didn't need its 1.5 s timeout.
    expect(launched.output.join('\n')).not.toContain('did not confirm its saves')
    expect(Date.now() - started).toBeLessThan(5000)

    launched = await launchApp({ userData })
    const loaded = await launched.page.evaluate((id) => window.api.workspace.load(id), ws.id)
    expect(loaded.name).toBe('Saved at close')
  } finally {
    await launched.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('API keys never appear in IPC results or workspace files', async () => {
  launched = await launchApp({ env: SECRETS })
  const results = await launched.page.evaluate(async (png) => {
    const api = window.api
    const ws = await api.workspace.create({ name: 'Secrets', researchQuestion: 'Q' })
    const out: unknown[] = [ws]
    out.push(await api.workspace.list())
    out.push(await api.workspace.load(ws.id))
    out.push(await api.workspace.save(ws))
    out.push(await api.workspace.duplicate(ws.id))
    out.push(await api.thumb.save(ws.id, 'card-1', png))
    out.push(await api.ai.status())
    out.push(await api.ai.summarize('Some page text'))
    out.push(await api.ai.embed(ws.id, [{ id: 'a', text: 'x' }]))
    out.push(
      await api.ai.organize({
        workspaceId: ws.id,
        questionNodeId: 'q',
        nodes: [],
        groups: [],
        edges: []
      })
    )
    return out
  }, TINY_PNG_DATA_URL)
  const text = JSON.stringify(results)
  expect(text).not.toContain('SECRET')
  // ai.status still knows both keys are set.
  expect(results[6]).toEqual({ anthropic: true, groq: true })
  for (const file of filesUnder(join(launched.userData, 'workspaces'))) {
    expect(readFileSync(file).toString('latin1')).not.toContain('SECRET')
  }
})

test('read-only debug hooks exist in test runs', async () => {
  launched = await launchApp()
  const hooks = await launched.page.evaluate(() => ({
    board: window.__waDebug?.getBoard(),
    history: window.__waDebug?.getHistorySizes(),
    session: window.__waDebug?.getSession(),
    frozen: Object.isFrozen(window.__waDebug)
  }))
  expect(hooks).toEqual({
    board: { nodes: {}, groups: {}, edges: {}, ghosts: {} },
    history: { past: 0, future: 0 },
    session: null,
    frozen: true
  })
})
