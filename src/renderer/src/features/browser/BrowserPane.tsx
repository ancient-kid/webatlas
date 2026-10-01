// The embedded browser: capture bar + <webview>. The webview's src is set once at mount
// (to the session's last URL); after that it is only ever driven with loadURL, so React
// never reloads the page. It registers itself as the app's browser (browserControl), so
// capture, hotkeys and "Open in browser pane" can use it.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { CaptureBar } from '@renderer/components/wa/CaptureBar'
import { useAppStore } from '@renderer/store/appStore'
import { capture } from '../capture'
import { registerBrowser } from './browserControl'
import { toUrl } from './toUrl'
import { WEBVIEW_STRING_ATTRS, webviewRef } from './webviewElement'

const PARTITION = 'persist:webatlas-browse'
/** Auto mode waits this long after the page settles (SPAs change their title late). */
export const AUTO_CAPTURE_DELAY_MS = 1500
const THUMB_WIDTH = 520

export interface BrowserPaneProps {
  onCollapse?: () => void
}

export function BrowserPane({ onCollapse }: BrowserPaneProps): ReactElement {
  const session = useAppStore((s) => s.session)
  const patchSession = useAppStore((s) => s.patchSession)
  const ref = useRef<Electron.WebviewTag | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [initialSrc] = useState(() => useAppStore.getState().session.browserUrl)
  const [url, setUrl] = useState(initialSrc)
  const [nav, setNav] = useState({ back: false, forward: false })
  const ready = useRef(false)
  const pending = useRef<string | null>(null)
  const favicon = useRef<string | undefined>(undefined)

  // Navigate now if the page is ready, otherwise as soon as it is.
  const go = useCallback((target: string): void => {
    const wv = ref.current
    if (!target || !wv) return
    if (!ready.current) {
      pending.current = target
      return
    }
    // loadURL rejects when a newer navigation replaces this one; that is expected.
    wv.loadURL(target).catch(() => undefined)
  }, [])

  useEffect(() => {
    const wv = ref.current
    if (!wv) return
    capture.reset()
    let autoTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleAuto = (): void => {
      if (useAppStore.getState().session.captureMode !== 'auto') return
      clearTimeout(autoTimer)
      autoTimer = setTimeout(() => void capture.capturePage('auto'), AUTO_CAPTURE_DELAY_MS)
    }
    const sync = (next: string): void => {
      if (!next || next === 'about:blank') return
      setUrl(next)
      useAppStore.getState().patchSession({ browserUrl: next })
      capture.onNavigated(next)
      try {
        setNav({ back: wv.canGoBack(), forward: wv.canGoForward() })
      } catch {
        // Not attached yet.
      }
    }
    const onReady = (): void => {
      ready.current = true
      if (pending.current) {
        const target = pending.current
        pending.current = null
        go(target)
      }
    }
    const onNavigate = (e: Event): void => {
      favicon.current = undefined
      sync((e as Electron.DidNavigateEvent).url)
      scheduleAuto()
    }
    const onInPage = (e: Event): void => {
      const ev = e as Electron.DidNavigateInPageEvent
      if (!ev.isMainFrame) return
      sync(ev.url)
      scheduleAuto()
    }
    const onFavicon = (e: Event): void => {
      favicon.current = (e as Electron.PageFaviconUpdatedEvent).favicons[0]
    }
    const onSettled = (): void => scheduleAuto()

    wv.addEventListener('dom-ready', onReady)
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onInPage)
    wv.addEventListener('page-favicon-updated', onFavicon)
    wv.addEventListener('did-stop-loading', onSettled)
    wv.addEventListener('page-title-updated', onSettled)
    // Popups (target=_blank, window.open) open here: "opened from" the current page.
    const offPopup = window.api.on('browser:open-url', go)

    const unregister = registerBrowser({
      isReady: () => ready.current,
      getURL: () => {
        try {
          return wv.getURL()
        } catch {
          return ''
        }
      },
      navigate: (target, options) => {
        if (options?.typed) capture.onTyped()
        go(target)
      },
      exec: async <T,>(script: string, fallback: T): Promise<T> => {
        if (!ready.current) return fallback
        try {
          const value = (await wv.executeJavaScript(script)) as T | null | undefined
          return value ?? fallback
        } catch {
          return fallback
        }
      },
      thumbnail: async () => {
        if (!ready.current) return null
        try {
          const image = await wv.capturePage()
          return image.isEmpty() ? null : image.resize({ width: THUMB_WIDTH }).toDataURL()
        } catch {
          return null
        }
      },
      favicon: () => favicon.current,
      focusAddress: () => {
        input.current?.focus()
        input.current?.select()
      }
    })

    return () => {
      clearTimeout(autoTimer)
      wv.removeEventListener('dom-ready', onReady)
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onInPage)
      wv.removeEventListener('page-favicon-updated', onFavicon)
      wv.removeEventListener('did-stop-loading', onSettled)
      wv.removeEventListener('page-title-updated', onSettled)
      offPopup()
      unregister()
    }
  }, [go])

  const call = (fn: (wv: Electron.WebviewTag) => void): void => {
    const wv = ref.current
    if (wv && ready.current) fn(wv)
  }

  return (
    <div className="wa-browser">
      <CaptureBar
        url={url}
        mode={session.captureMode}
        onModeChange={(captureMode) => patchSession({ captureMode })}
        onNavigate={(text) => {
          capture.onTyped()
          go(toUrl(text))
        }}
        onAdd={() => void capture.capturePage('manual')}
        onBack={() => call((wv) => wv.goBack())}
        onForward={() => call((wv) => wv.goForward())}
        onReload={() => call((wv) => wv.reload())}
        canGoBack={nav.back}
        canGoForward={nav.forward}
        onCollapse={onCollapse}
        inputRef={input}
      />
      <webview
        ref={webviewRef(ref)}
        data-testid="browser-webview"
        src={initialSrc}
        partition={PARTITION}
        {...WEBVIEW_STRING_ATTRS}
      />
    </div>
  )
}
