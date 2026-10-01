// Pure rules for turning a web page into a card.
import { hostOf, isHttpUrl, titleFromUrl, type ResourceKind } from '@shared/kind'
import type { PageMeta } from '../browser/webviewScripts'

export const SUMMARY_SOURCE_CHARS = 3000
export const TITLE_MAX_CHARS = 200

export const EMPTY_META: PageMeta = {
  title: '',
  ogTitle: '',
  ogImage: '',
  description: '',
  siteName: '',
  contentType: '',
  favicon: ''
}

/** Why a URL can't be captured, as a toast in DESIGN.md voice, or null when it can. */
export function uncapturableReason(url: string): string | null {
  if (!url || !isHttpUrl(url)) return 'Open a page first, then add it.'
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    // Google's own pages (home, results) are where you find sources, not sources.
    if (/^google\.[a-z.]+$/.test(host) && ['/', '/search', '/webhp'].includes(u.pathname)) {
      return 'Open a result first, then add it.'
    }
  } catch {
    return 'Open a page first, then add it.'
  }
  return null
}

export function isCapturable(url: string): boolean {
  return uncapturableReason(url) === null
}

/** Card title: og:title, then <title>, then the PDF file name or the host. */
export function cardTitle(meta: PageMeta, url: string, kind: ResourceKind): string {
  const fromPage = (meta.ogTitle || meta.title).replace(/\s+/g, ' ').trim()
  const title = fromPage || (kind === 'pdf' ? titleFromUrl(url) : hostOf(url)) || url
  return title.slice(0, TITLE_MAX_CHARS)
}

/** Text kept on the card for search and AI: article text, or the description for videos. */
export function cardText(kind: ResourceKind, articleText: string, meta: PageMeta): string {
  if (kind === 'video') return meta.description
  return articleText
}

/** What the summariser reads: the page description, then the start of the text. */
export function summaryInput(meta: PageMeta, text: string): string {
  const parts = [meta.description.trim(), text.trim()].filter(Boolean)
  return parts.join('\n').slice(0, SUMMARY_SOURCE_CHARS)
}
