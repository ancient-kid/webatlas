/**
 * Answers main's 'app:before-close': runs `flush` (pending autosaves, wired in T08), then
 * tells main the window may close. A failed flush still lets the window close.
 * Returns the unsubscribe function.
 */
export function installCloseHandshake(flush: () => Promise<void>): () => void {
  return window.api.on('app:before-close', () => {
    void flush()
      .catch((err) => console.error('[close] flush failed', err))
      .finally(() => window.api.app.readyToClose())
  })
}
