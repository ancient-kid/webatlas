import { useAppStore } from '@renderer/store/appStore'
import { browser } from './browserControl'

/** Shows the browser pane (if hidden) and loads a URL in it. */
export function openInBrowser(url: string): void {
  useAppStore.getState().patchSession({ browserOpen: true })
  browser()?.navigate(url)
}
