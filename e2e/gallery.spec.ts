import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTIFACTS = join(__dirname, 'artifacts')

let launched: LaunchedApp
test.beforeEach(async () => {
  launched = await launchApp()
})
test.afterEach(async () => {
  await launched.close()
})

/** Opens the gallery through the real View → Component gallery menu item. */
async function openGallery(l: LaunchedApp): Promise<void> {
  await l.app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.getMenuItemById('dev-gallery')?.click()
  )
  await expect(l.page.getByTestId('gallery')).toBeVisible()
}

async function setTheme(l: LaunchedApp, theme: 'light' | 'dark'): Promise<void> {
  // Playwright emulates a light colour scheme by default; turn that off so the real
  // OS setting (Electron nativeTheme) is what the page sees.
  await l.page.emulateMedia({ colorScheme: null })
  await l.app.evaluate(({ nativeTheme }, t) => {
    nativeTheme.themeSource = t
  }, theme)
  await expect(l.page.locator('html')).toHaveAttribute('data-theme', theme)
}

const bodyBackground = (l: LaunchedApp): Promise<string> =>
  l.page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('the gallery follows the OS theme and is saved as screenshots for review', async () => {
  mkdirSync(ARTIFACTS, { recursive: true })
  await openGallery(launched)

  await setTheme(launched, 'light')
  expect(await bodyBackground(launched)).toBe('rgb(243, 239, 230)') // #f3efe6
  await launched.page.screenshot({ path: join(ARTIFACTS, 'gallery-light.png'), fullPage: true })

  await setTheme(launched, 'dark')
  expect(await bodyBackground(launched)).toBe('rgb(18, 23, 21)') // #121715
  await launched.page.screenshot({ path: join(ARTIFACTS, 'gallery-dark.png'), fullPage: true })

  // Back to light without a restart.
  await setTheme(launched, 'light')
  expect(await bodyBackground(launched)).toBe('rgb(243, 239, 230)')
})

test('the bundled fonts load (Fraunces, IBM Plex Sans and IBM Plex Mono)', async () => {
  await openGallery(launched)
  const fonts = await launched.page.evaluate(async () => {
    await document.fonts.ready
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
    return {
      loaded: [...new Set(loaded.map((f) => f.replace(/["']/g, '')))].sort(),
      wordmark: getComputedStyle(document.querySelector('h1')!).fontFamily
    }
  })
  expect(fonts.loaded).toEqual(
    expect.arrayContaining(['Fraunces Variable', 'IBM Plex Mono', 'IBM Plex Sans'])
  )
  expect(fonts.wordmark).toMatch(/^"?Fraunces Variable/)
})

test('the gallery renders every section without console or CSP errors', async () => {
  await openGallery(launched)
  for (const name of [
    'Colour',
    'Type',
    'Icons',
    'Buttons',
    'Tags',
    'Cards',
    'Groups and edges',
    'Suggestions',
    'Toolbar, palette and view switcher',
    'Capture bar',
    'Workspace cards',
    'Canvas',
    'Overlays'
  ]) {
    await expect(launched.page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  await launched.page.waitForTimeout(300)
  expect(launched.errors).toEqual([])
})

test('the menu item toggles back to the app', async () => {
  await openGallery(launched)
  await launched.app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.getMenuItemById('dev-gallery')?.click()
  )
  await expect(launched.page.getByTestId('app-root')).toBeVisible()
})
