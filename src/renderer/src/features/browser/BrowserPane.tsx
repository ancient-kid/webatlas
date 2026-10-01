// The embedded browser: capture bar + <webview>. The webview's src is set once at mount
// (to the session's last URL); after that it is only ever driven with loadURL, so React
// never reloads the page. Capture ("Add to canvas") arrives in T11.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { CaptureBar } from '@renderer/components/wa/CaptureBar'
import { useAppStore } from '@renderer/store/appStore'
import { toUrl } from './toUrl'
import { WEBVIEW_STRING_ATTRS, webviewRef } from './webviewElement'

const PARTITION = 'persist:webatlas-browse'

export interface BrowserPaneProps {
  onCollapse?: () => void
}

export function BrowserPane({ onCollapse }: BrowserPaneProps): ReactElement {
  const session = useAppStore((s) => s.session)
  const patchSession = useAppStore((s) => s.patchSession)
  const ref = useRef<Electron.WebviewTag | null>(null)
  const [initialSrc] = useState(() => useAppStore.getState().session.browserUrl)
  const [url, setUrl] = useState(initialSrc)
  const [nav, setNav] = useState({ back: false, forward: false })
  const ready = useRef(false)
  const pending = useRef<string | null>(null)

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
    const sync = (next: string): void => {
      if (!next || next === 'about:blank') return
      setUrl(next)
      useAppStore.getState().patchSession({ browserUrl: next })
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
    const onNavigate = (e: Event): void => sync((e as Electron.DidNavigateEvent).url)
    const onInPage = (e: Event): void => {
      const ev = e as Electron.DidNavigateInPageEvent
      if (ev.isMainFrame) sync(ev.url)
    }
    wv.addEventListener('dom-ready', onReady)
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onInPage)
    // Popups (target=_blank, window.open) open here instead of a new window.
    const offPopup = window.api.on('browser:open-url', go)
    return () => {
      wv.removeEventListener('dom-ready', onReady)
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onInPage)
      offPopup()
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
        onNavigate={(input) => go(toUrl(input))}
        onBack={() => call((wv) => wv.goBack())}
        onForward={() => call((wv) => wv.goForward())}
        onReload={() => call((wv) => wv.reload())}
        canGoBack={nav.back}
        canGoForward={nav.forward}
        onCollapse={onCollapse}
        addDisabled
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
