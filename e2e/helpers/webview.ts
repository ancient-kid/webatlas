import { expect, type ElectronApplication, type Page } from '@playwright/test'

export const TEST_WEBVIEW_ID = 'test-webview'

/**
 * Adds a <webview> to the app window and resolves once its guest has loaded `url`.
 * The renderer deliberately asks for a different partition; main must override it.
 */
export async function attachWebview(
  app: ElectronApplication,
  page: Page,
  url: string
): Promise<void> {
  await page.evaluate(
    ({ src, id }) => {
      const wv = document.createElement('webview')
      wv.setAttribute('src', src)
      wv.setAttribute('allowpopups', 'true')
      wv.setAttribute('partition', 'persist:something-else')
      wv.style.cssText = 'width:800px;height:600px;display:inline-flex'
      wv.id = id
      // Record events so tests can assert on them from the renderer side.
      const log: string[] = []
      ;(window as unknown as { __wvEvents: string[] }).__wvEvents = log
      wv.addEventListener('dom-ready', () => log.push('dom-ready'))
      wv.addEventListener('did-navigate', (e) =>
        log.push(`did-navigate ${(e as Electron.DidNavigateEvent).url}`)
      )
      wv.addEventListener('did-navigate-in-page', (e) => {
        const ev = e as Electron.DidNavigateInPageEvent
        if (ev.isMainFrame) log.push(`did-navigate-in-page ${ev.url}`)
      })
      document.body.appendChild(wv)
    },
    { src: url, id: TEST_WEBVIEW_ID }
  )
  await expect
    .poll(() =>
      app.evaluate(({ webContents }) => {
        const guest = webContents.getAllWebContents().find((w) => w.getType() === 'webview')
        return guest && !guest.isLoading() ? guest.getURL() : ''
      })
    )
    .toBe(url)
  await expect.poll(() => webviewEvents(page)).toContain('dom-ready')
}

/** Events recorded on the test webview (renderer side). */
export function webviewEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as unknown as { __wvEvents?: string[] }).__wvEvents ?? [])
  ])
}

/** Runs a script in the guest page through the renderer's <webview> element. */
export function execInWebview<T>(page: Page, script: string, userGesture = false): Promise<T> {
  return page.evaluate(
    ({ id, code, gesture }) =>
      (document.getElementById(id) as unknown as Electron.WebviewTag).executeJavaScript(
        code,
        gesture
      ),
    { id: TEST_WEBVIEW_ID, code: script, gesture: userGesture }
  ) as Promise<T>
}
