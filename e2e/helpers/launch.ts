import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  /** Isolated app-data folder for this run (deleted by close()). */
  userData: string
  /** Console errors and uncaught page errors collected from the app window. */
  errors: string[]
  /** Lines the main process wrote to stdout/stderr (e.g. `[organize] …`). */
  output: string[]
  close: () => Promise<void>
}

export interface LaunchOptions {
  /** Reuse an existing app-data folder (for relaunch/persistence tests). */
  userData?: string
  env?: Record<string, string>
}

const MAIN_ENTRY = resolve(__dirname, '../../out/main/index.js')
const LINE_BREAK = /\r?\n/

/** Launches the built app with test hooks enabled and an isolated app-data folder. */
export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const userData = options.userData ?? mkdtempSync(join(tmpdir(), 'webatlas-e2e-'))
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  // Never load the dev server or run Electron as plain Node inside tests.
  delete env.ELECTRON_RENDERER_URL
  delete env.ELECTRON_RUN_AS_NODE
  Object.assign(env, { WA_E2E: '1', WA_USER_DATA: userData }, options.env)

  const app = await electron.launch({ args: [MAIN_ENTRY], env })
  const output: string[] = []
  const collect = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split(LINE_BREAK)) {
      if (line.trim()) output.push(line)
    }
  }
  app.process().stdout?.on('data', collect)
  app.process().stderr?.on('data', collect)
  const page = await app.firstWindow()
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  await page.waitForLoadState('domcontentloaded')

  const close = async (): Promise<void> => {
    await app.close().catch(() => undefined)
    if (!options.userData) rmSync(userData, { recursive: true, force: true })
  }
  return { app, page, userData, errors, output, close }
}
