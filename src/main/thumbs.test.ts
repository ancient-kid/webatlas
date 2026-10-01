import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TINY_PNG_DATA_URL } from '@shared/testing/factories'
import { initPaths, thumbFile } from './storage/paths'
import { createWorkspace } from './storage/workspaceStore'
import { decodePng, parseThumbUrl, saveThumb, serveThumb, thumbUrl } from './thumbs'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wa-thumbs-'))
  initPaths(dir)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('thumbnail URLs', () => {
  it('parses workspace and card ids and ignores ?v=', () => {
    expect(parseThumbUrl('wa-thumb://ab12-cd/node-1.png?v=123')).toEqual({
      workspaceId: 'ab12-cd',
      nodeId: 'node-1'
    })
    expect(parseThumbUrl(thumbUrl('ws-1', 'n_2', 5))).toEqual({
      workspaceId: 'ws-1',
      nodeId: 'n_2'
    })
  })

  it('resolves dot segments inside the URL, so a path can never leave its workspace', () => {
    expect(parseThumbUrl('wa-thumb://ws-1/../../secret.png')).toEqual({
      workspaceId: 'ws-1',
      nodeId: 'secret'
    })
  })

  it.each([
    'wa-thumb://../../x',
    'wa-thumb://ws-1/a/b.png',
    'wa-thumb://ws-1/node.jpg',
    'wa-thumb://ws_1/node.png',
    'https://ws-1/node.png',
    'not a url'
  ])('rejects %s', (url) => {
    expect(parseThumbUrl(url)).toBeNull()
  })
})

describe('decodePng', () => {
  it('accepts a PNG data URL', () => {
    expect(decodePng(TINY_PNG_DATA_URL).subarray(1, 4).toString()).toBe('PNG')
  })

  it.each([
    ['not a string', 42],
    ['a JPEG', 'data:image/jpeg;base64,/9j/4AAQ'],
    ['fake PNG bytes', 'data:image/png;base64,' + Buffer.from('hello').toString('base64')]
  ])('rejects %s', (_, value) => {
    expect(() => decodePng(value)).toThrow()
  })
})

describe('saveThumb and serveThumb', () => {
  it('writes the PNG into the workspace and serves it back', async () => {
    const ws = await createWorkspace({ name: 'Thumbs' })
    const url = await saveThumb(ws.id, 'card-1', TINY_PNG_DATA_URL)
    expect(url).toMatch(new RegExp(`^wa-thumb://${ws.id}/card-1\\.png\\?v=\\d+$`))
    expect(readFileSync(thumbFile(ws.id, 'card-1'))).toEqual(decodePng(TINY_PNG_DATA_URL))

    const res = await serveThumb(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(decodePng(TINY_PNG_DATA_URL))
  })

  it('refuses unknown workspaces and bad ids', async () => {
    await expect(saveThumb('nope', 'card-1', TINY_PNG_DATA_URL)).rejects.toThrow(
      'Workspace not found'
    )
    await expect(saveThumb('../x', 'card-1', TINY_PNG_DATA_URL)).rejects.toThrow(
      'Invalid workspace id'
    )
    await expect(saveThumb('nope', '../card', TINY_PNG_DATA_URL)).rejects.toThrow('Invalid card id')
  })

  it('answers 400 for a bad URL and 404 for a missing file', async () => {
    expect((await serveThumb('wa-thumb://../../x')).status).toBe(400)
    expect((await serveThumb('wa-thumb://ws-1/missing.png')).status).toBe(404)
  })
})
