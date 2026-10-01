// Dark mode follows the operating system (no in-app toggle). The tokens switch on
// `data-theme` on <html>; this keeps it in sync, including live changes.
export type Theme = 'light' | 'dark'

const QUERY = '(prefers-color-scheme: dark)'

export function systemTheme(): Theme {
  return window.matchMedia?.(QUERY).matches ? 'dark' : 'light'
}

/** Applies the current OS theme and follows changes. Returns a function that stops following. */
export function followSystemTheme(root: HTMLElement = document.documentElement): () => void {
  const apply = (): void => {
    root.dataset.theme = systemTheme()
  }
  apply()
  const media = window.matchMedia?.(QUERY)
  media?.addEventListener('change', apply)
  return () => media?.removeEventListener('change', apply)
}
