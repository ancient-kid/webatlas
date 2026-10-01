import { expect, test, type Page } from '@playwright/test'
import { FIXTURE_ORIGIN } from '../playwright.config'
import type { CanvasNode } from '../src/shared/types'
import { clickEmpty, createWorkspace, getBoard } from './helpers/canvas'
import { launchApp, type LaunchedApp } from './helpers/launch'

const ARTICLE = `${FIXTURE_ORIGIN}/article.html`
const LINKED = `${FIXTURE_ORIGIN}/linked.html`

let launched: LaunchedApp
test.beforeEach(async () => {
  launched = await launchApp({ env: { WA_AI_MOCK: '1' } })
  await launched.page.setViewportSize({ width: 1440, height: 900 })
  await createWorkspace(launched.page, 'Hotkeys')
  const address = launched.page.getByRole('textbox', { name: 'Address' })
  await address.fill(ARTICLE)
  await address.press('Enter')
  await expect.poll(() => guestUrl(launched)).toBe(ARTICLE)
  await launched.page.waitForTimeout(300)
})
test.afterEach(async () => {
  await launched.close()
})

const guestUrl = (l: LaunchedApp): Promise<string> =>
  l.app.evaluate(({ webContents }) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
    return g ? g.getURL() : ''
  })

const inGuest = (l: LaunchedApp, code: string): Promise<unknown> =>
  l.app.evaluate(({ webContents }, js) => {
    const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
    return g.executeJavaScript(js, true)
  }, code)

/** Clicks an application-menu item, as its accelerator would. */
const menu = (l: LaunchedApp, id: string): Promise<void> =>
  l.app.evaluate(({ Menu }, itemId) => {
    Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click()
  }, id)

/** Simulates a right-click in the page and clicks one of the menu's items. */
async function rightClick(
  l: LaunchedApp,
  params: { selectionText?: string; linkURL?: string; linkText?: string },
  itemId?: string
): Promise<string[]> {
  return l.app.evaluate(
    ({ webContents }, { p, id }) => {
      const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview')!
      g.emit('context-menu', {}, { selectionText: '', linkURL: '', linkText: '', ...p })
      const m = (globalThis as unknown as { __waContextMenu: Electron.Menu }).__waContextMenu
      if (id) m.getMenuItemById(id)!.click()
      return m.items.filter((i) => i.type !== 'separator').map((i) => i.label)
    },
    { p: params, id: itemId }
  )
}

async function cards(page: Page): Promise<CanvasNode[]> {
  return Object.values((await getBoard(page)).nodes).filter(
    (n) => n.kind !== 'question' && n.kind !== 'note'
  )
}

const selectInPage = (l: LaunchedApp, elementId: string): Promise<unknown> =>
  inGuest(
    l,
    `(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('${elementId}') ?? document.querySelector('p')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return String(s) })()`
  )

test('Alt+A (menu "capture") captures the page while the web page has focus', async () => {
  await launched.app.evaluate(({ webContents }) => {
    webContents
      .getAllWebContents()
      .find((w) => w.getType() === 'webview')!
      .focus()
  })
  await menu(launched, 'capture')
  await expect.poll(async () => (await cards(launched.page)).map((c) => c.url)).toEqual([ARTICLE])
})

test('Alt+H adds the selected text as a highlight (capturing the page first); Ctrl+Z removes it', async () => {
  const { page } = launched
  const selected = (await selectInPage(launched, 'missing')) as string
  expect(selected.length).toBeGreaterThan(20)
  await menu(launched, 'highlight')
  await expect.poll(async () => (await cards(page))[0]?.highlights.length ?? 0).toBe(1)
  const [card] = await cards(page)
  expect(card.highlights[0].quote).toBe(selected.replace(/\s+/g, ' ').trim().slice(0, 600))
  await expect(page.getByText('Highlight added')).toBeVisible()
  await expect(page.locator(`.react-flow__node[data-id="${card.id}"] .wa-quote`)).toBeVisible()

  await clickEmpty(page)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await cards(page))[0].highlights.length).toBe(0)
})

test('Alt+H with nothing selected asks for a selection', async () => {
  await inGuest(launched, 'getSelection().removeAllRanges()')
  await menu(launched, 'highlight')
  await expect(launched.page.getByText('Select text on the page first.')).toBeVisible()
  expect(await cards(launched.page)).toHaveLength(0)
})

test('right-click menu: highlight, link and page items do what they say', async () => {
  const { page } = launched
  expect(await rightClick(launched, {})).toEqual(['Add page to canvas'])
  expect(
    await rightClick(launched, {
      selectionText: 'Water squares',
      linkURL: LINKED,
      linkText: 'Case study'
    })
  ).toEqual(['Add highlight to canvas', 'Add link to canvas', 'Add page to canvas', 'Copy'])

  await rightClick(launched, {}, 'context-page')
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  const [pageCard] = await cards(page)

  await rightClick(
    launched,
    { linkURL: LINKED, linkText: 'Rotterdam water squares' },
    'context-link'
  )
  await expect.poll(async () => (await cards(page)).length).toBe(2)
  const link = (await cards(page)).find((c) => c.url === LINKED)!
  expect(link).toMatchObject({ title: 'Rotterdam water squares', capturedFromNodeId: pageCard.id })
  expect(link.thumbnailPath).toBeUndefined()

  await rightClick(launched, { selectionText: '  A quote from the menu  ' }, 'context-highlight')
  await expect
    .poll(async () =>
      (await cards(page)).find((c) => c.id === pageCard.id)!.highlights.map((h) => h.quote)
    )
    .toEqual(['A quote from the menu'])
})

test('Ctrl+L (menu "address") focuses the address bar with its text selected', async () => {
  const { page } = launched
  await menu(launched, 'address')
  const address = page.getByRole('textbox', { name: 'Address' })
  await expect(address).toBeFocused()
  expect(
    await address.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)
  ).toBe(ARTICLE.length)
})

test('with the browser hidden, Alt+A shows it instead of capturing', async () => {
  const { page } = launched
  await page.getByRole('button', { name: 'Hide browser', exact: true }).click()
  await menu(launched, 'capture')
  await expect(page.getByTestId('browser-webview')).toBeVisible()
  await expect(page.getByText('Browser shown. Press Alt+A again to add this page.')).toBeVisible()
  expect(await cards(page)).toHaveLength(0)
})

test('a link dropped on the canvas becomes a card where it was dropped', async () => {
  const { page } = launched
  const box = (await page.getByTestId('canvas').boundingBox())!
  const at = { x: box.x + 200, y: box.y + 200 }
  await page.evaluate(
    ({ url, x, y }) => {
      const data = new DataTransfer()
      data.setData('text/uri-list', url)
      const target = document.querySelector('.react-flow__pane')!
      for (const type of ['dragover', 'drop']) {
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer: data
          })
        )
      }
    },
    { url: LINKED, ...at }
  )
  await expect.poll(async () => (await cards(page)).length).toBe(1)
  const [card] = await cards(page)
  expect(card.url).toBe(LINKED)
  const el = (await page.locator(`.react-flow__node[data-id="${card.id}"]`).boundingBox())!
  expect(Math.abs(el.x - at.x)).toBeLessThan(40)
  expect(Math.abs(el.y - at.y)).toBeLessThan(40)
})
