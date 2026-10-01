import type { Ref, RefObject } from 'react'

/**
 * Extra <webview> attributes as strings. React's built-in typing declares
 * `allowpopups` as a boolean, but React does not write boolean attributes on this
 * element; Electron needs the literal attribute `allowpopups="true"` to be present
 * before the guest attaches, or window.open never reaches our popup handler.
 */
export const WEBVIEW_STRING_ATTRS = { allowpopups: 'true' } as Record<string, string>

/** React types the element as HTMLWebViewElement; the real API is Electron.WebviewTag. */
export function webviewRef(ref: RefObject<Electron.WebviewTag | null>): Ref<HTMLWebViewElement> {
  return ref as unknown as Ref<HTMLWebViewElement>
}
