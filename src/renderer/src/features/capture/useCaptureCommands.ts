// Menu shortcuts (Alt+A, Alt+H, Ctrl+L, Ctrl+K) and the web page's right-click actions.
// They arrive from the main process, so they work even while focus is in the web page.
import { useEffect } from 'react'
import { toast } from 'sonner'
import type { ContextAction, MenuAction } from '@shared/api'
import { useAppStore } from '@renderer/store/appStore'
import { browser } from '../browser/browserControl'
import { capture } from './index'

/** Shows the browser if hidden. Returns true if it was hidden (the action waits). */
function revealBrowser(): boolean {
  const { session, patchSession } = useAppStore.getState()
  if (session.browserOpen) return false
  patchSession({ browserOpen: true })
  return true
}

export function runMenuAction(action: MenuAction): void {
  switch (action) {
    case 'capture':
      // Capturing needs a visible page: with the browser hidden, show it first.
      if (revealBrowser()) toast('Browser shown. Press Alt+A again to add this page.')
      else void capture.capturePage('manual')
      break
    case 'highlight':
      if (revealBrowser()) toast('Browser shown. Select text, then press Alt+H.')
      else void capture.highlight()
      break
    case 'address':
      revealBrowser()
      requestAnimationFrame(() => browser()?.focusAddress())
      break
    case 'palette':
      toast('Search arrives in a later step.')
      break
    case 'toggle-browser':
      // Handled by the workspace screen.
      break
  }
}

export function runContextAction(action: ContextAction): void {
  switch (action.type) {
    case 'highlight':
      void capture.highlight(action.text)
      break
    case 'link':
      capture.captureLink(action.url, action.text)
      break
    case 'page':
      void capture.capturePage('manual')
      break
  }
}

/** Subscribes to the main-process shortcuts and context actions while mounted. */
export function useCaptureCommands(): void {
  useEffect(() => {
    const offMenu = window.api.on('menu:action', runMenuAction)
    const offContext = window.api.on('browser:context-action', runContextAction)
    return () => {
      offMenu()
      offContext()
    }
  }, [])
}
