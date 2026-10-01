import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importFromDialog, saveExport } from './exportImport'
import { initPaths, thumbFile } from './storage/paths'

describe('main: exportImport', () => {
  const tmpDir = join(process.cwd(), 'scratch/test-export-import')
  const saveDir = join(tmpDir, 'saved')
  const wsId = 'ws-test-export-import'

  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    await fs.mkdir(saveDir, { recursive: true })
    initPaths(tmpDir)
    process.env.WA_E2E = '1'
    process.env.WA_E2E_SAVE_DIR = saveDir
  })

  afterEach(async () => {
    delete process.env.WA_E2E
    delete process.env.WA_E2E_SAVE_DIR
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('JSON export bundles thumbs as data URLs and skips thumbs over 400 KB', async () => {
    // Small valid thumbnail
    const smallThumb = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02
    ])
    // Large thumbnail (> 400 KB)
    const largeThumb = Buffer.alloc(450 * 1024, 0x89)

    await fs.mkdir(join(tmpDir, wsId, 'thumbs'), { recursive: true })
    await fs.writeFile(thumbFile(wsId, 'node-small'), smallThumb)
    await fs.writeFile(thumbFile(wsId, 'node-large'), largeThumb)

    const workspaceData = {
      format: 'webatlas',
      version: 1,
      workspace: {
        id: wsId,
        name: 'Test Export',
        board: { nodes: {}, groups: {}, edges: {}, ghosts: {} }
      }
    }

    const savedPath = await saveExport(null, 'json', JSON.stringify(workspaceData), 'export-test')
    expect(savedPath).toBeDefined()
    expect(savedPath).toContain('export-test.json')

    const fileContent = JSON.parse(await fs.readFile(savedPath!, 'utf8'))
    expect(fileContent.thumbs).toBeDefined()
    expect(fileContent.thumbs['node-small']).toMatch(/^data:image\/png;base64,/)
    // Large thumb skipped
    expect(fileContent.thumbs['node-large']).toBeUndefined()
  })

  it('import rejects a non-WebAtlas file', async () => {
    const invalidFile = join(saveDir, 'invalid.json')
    await fs.writeFile(invalidFile, JSON.stringify({ not: 'a webatlas file' }))

    await expect(importFromDialog(null)).rejects.toThrow("This file isn't a WebAtlas workspace")
  })
})
