import { expect, test } from '@playwright/test'
import { mkdtempSync, promises as fs, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getBoard } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

let launched: LaunchedApp
let userData: string
let saveDir: string

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'webatlas-export-user-'))
  saveDir = mkdtempSync(join(tmpdir(), 'webatlas-export-save-'))
  launched = await launchApp({
    userData,
    env: {
      WA_AI_MOCK: '1',
      WA_E2E_SAVE_DIR: saveDir
    }
  })
  await launched.page.setViewportSize({ width: 1440, height: 900 })
})

test.afterEach(async () => {
  await launched.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(saveDir, { recursive: true, force: true })
})

test('exporting md, json, and canvas writes valid files; importing json creates a workspace; Welcome opens sample workspace with 3 groups', async () => {
  const { page } = launched

  // 1. First run shows Welcome screen -> Open sample workspace
  await expect(page.getByRole('button', { name: 'Open sample workspace' })).toBeVisible()
  await page.getByRole('button', { name: 'Open sample workspace' }).click()

  // The sample workspace opens
  await expect(page.getByTestId('workspace-screen')).toBeVisible()
  await expect(page.getByTestId('workspace-name')).toHaveText('Sample: Coastal adaptation')

  // Verify sample has 3 groups
  await expect.poll(async () => Object.keys((await getBoard(page)).groups).length).toBe(3)

  // 2. Export md, json, and canvas via the top bar Export menu
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'Markdown (.md)' }).click()
  await expect(page.getByText(/Exported to.*\.md/)).toBeVisible()

  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'JSON (.json)' }).click()
  await expect(page.getByText(/Exported to.*\.json/)).toBeVisible()

  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'Obsidian Canvas (.canvas)' }).click()
  await expect(page.getByText(/Exported to.*\.canvas/)).toBeVisible()

  // Verify the 3 files exist on disk in saveDir
  await expect.poll(async () => (await fs.readdir(saveDir)).length).toBe(3)
  const files = await fs.readdir(saveDir)
  const mdFile = files.find((f) => f.endsWith('.md'))
  const jsonFile = files.find((f) => f.endsWith('.json'))
  const canvasFile = files.find((f) => f.endsWith('.canvas'))

  expect(mdFile).toBeDefined()
  expect(jsonFile).toBeDefined()
  expect(canvasFile).toBeDefined()

  // Verify contents parse
  const mdContent = await fs.readFile(join(saveDir, mdFile!), 'utf8')
  expect(mdContent).toContain('# Sample: Coastal adaptation')
  expect(mdContent).toContain('## Case studies')

  const jsonContent = JSON.parse(await fs.readFile(join(saveDir, jsonFile!), 'utf8'))
  expect(jsonContent.format).toBe('webatlas')
  expect(jsonContent.workspace.name).toBe('Sample: Coastal adaptation')

  const canvasContent = JSON.parse(await fs.readFile(join(saveDir, canvasFile!), 'utf8'))
  expect(Array.isArray(canvasContent.nodes)).toBe(true)
  expect(Array.isArray(canvasContent.edges)).toBe(true)

  // 3. Go Home and Import the JSON workspace
  await page.getByRole('button', { name: 'Back to home' }).click()
  await expect(page.getByRole('heading', { name: 'Your workspaces' })).toBeVisible()

  // Click Import
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.getByText(/Imported/)).toBeVisible()

  // Home now shows the imported workspace (options buttons exist for both workspaces)
  await expect(page.getByRole('button', { name: /Options for/ }).first()).toBeVisible()
  expect(await page.getByRole('button', { name: /Options for/ }).count()).toBe(2)
})
