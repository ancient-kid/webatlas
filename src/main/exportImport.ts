// Native save/open dialogs for export and import. In E2E runs (WA_E2E=1 with
// WA_E2E_SAVE_DIR set) the dialogs are skipped and that folder is used instead.
import { app, dialog, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ExportFormat } from '@shared/api'
import type { Workspace } from '@shared/types'
import { safeFileName } from './fileNames'
import { atomicWrite } from './storage/atomicWrite'
import { importWorkspaceFile } from './storage/workspaceStore'

const FORMATS: Record<ExportFormat, { ext: string; label: string }> = {
  md: { ext: 'md', label: 'Markdown' },
  json: { ext: 'json', label: 'WebAtlas workspace' },
  canvas: { ext: 'canvas', label: 'Obsidian Canvas' }
}
const MAX_IMPORT_BYTES = 64 * 1024 * 1024

function e2eDir(): string | null {
  return process.env.WA_E2E === '1' && process.env.WA_E2E_SAVE_DIR
    ? process.env.WA_E2E_SAVE_DIR
    : null
}

/** Saves export content where the student chooses. Returns the path, or null if cancelled. */
export async function saveExport(
  win: BrowserWindow | null,
  format: unknown,
  content: unknown,
  suggestedName: unknown
): Promise<string | null> {
  const spec = FORMATS[format as ExportFormat]
  if (!spec || typeof content !== 'string') throw new Error('Invalid export')
  const fileName = `${safeFileName(suggestedName)}.${spec.ext}`

  const testDir = e2eDir()
  let target: string | null
  if (testDir) {
    target = join(testDir, fileName)
  } else {
    const options = {
      defaultPath: join(app.getPath('documents'), fileName),
      filters: [{ name: spec.label, extensions: [spec.ext] }]
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    target = result.canceled || !result.filePath ? null : result.filePath
  }
  if (!target) return null
  await atomicWrite(target, content)
  return target
}

/** The newest .json in the E2E folder stands in for the file the student would pick. */
async function newestJson(dir: string): Promise<string | null> {
  const names = (await fs.readdir(dir).catch(() => [])).filter((n) => n.endsWith('.json'))
  const dated = await Promise.all(
    names.map(async (n) => ({ path: join(dir, n), mtime: (await fs.stat(join(dir, n))).mtimeMs }))
  )
  return dated.sort((a, b) => b.mtime - a.mtime)[0]?.path ?? null
}

/** Lets the student pick a shared workspace file and imports it as a new workspace. */
export async function importFromDialog(win: BrowserWindow | null): Promise<Workspace | null> {
  const testDir = e2eDir()
  let file: string | null
  if (testDir) {
    file = await newestJson(testDir)
  } else {
    const options = {
      properties: ['openFile' as const],
      filters: [{ name: 'WebAtlas workspace', extensions: ['json'] }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    file = result.canceled ? null : (result.filePaths[0] ?? null)
  }
  if (!file) return null

  const { size } = await fs.stat(file)
  if (size > MAX_IMPORT_BYTES) throw new Error('This file is too large to import')
  let data: unknown
  try {
    data = JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    throw new Error("This file isn't a WebAtlas workspace")
  }
  return importWorkspaceFile(data)
}
