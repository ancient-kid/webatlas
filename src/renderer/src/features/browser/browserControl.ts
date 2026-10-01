// What the rest of the app may ask of the embedded browser. BrowserPane registers the
// real implementation (backed by the <webview>) while it is mounted.

export interface BrowserControl {
  /** The page has loaded far enough for scripts and captures. */
  isReady(): boolean
  getURL(): string
  /** Navigates the pane. `typed` = the student entered it (no "opened from" link). */
  navigate(url: string, options?: { typed?: boolean }): void
  /** Runs a script in the page; resolves to `fallback` on any failure. */
  exec<T>(script: string, fallback: T): Promise<T>
  /** A PNG data URL of the visible page, resized for a card thumbnail, or null. */
  thumbnail(): Promise<string | null>
  /** The page's favicon as reported by the browser, if any. */
  favicon(): string | undefined
  focusAddress(): void
}

let current: BrowserControl | null = null

export function registerBrowser(control: BrowserControl): () => void {
  current = control
  return () => {
    if (current === control) current = null
  }
}

/** The browser pane, or null when no workspace is open. */
export function browser(): BrowserControl | null {
  return current
}
