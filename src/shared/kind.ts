// URL helpers: which kind of card a resource becomes, and a normalised form of a URL
// used to spot duplicates ("capture the same page twice → select the existing card").
import type { NodeKind } from './types'

/** Card kinds a captured resource can have (notes and questions are made on the canvas). */
export type ResourceKind = Extract<NodeKind, 'webpage' | 'video' | 'pdf'>

function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

/** Host without a leading "www.", lowercased. */
function bareHost(u: URL): string {
  return u.hostname.toLowerCase().replace(/^www\./, '')
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com'])

/** The YouTube video id of a watch, shorts or youtu.be URL, if any. */
function youtubeId(u: URL): string | null {
  const host = bareHost(u)
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  if (!YOUTUBE_HOSTS.has(host)) return null
  if (u.pathname === '/watch') return u.searchParams.get('v') || null
  const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/)
  return m ? m[2] : null
}

/** True for an http(s) URL. */
export function isHttpUrl(url: string): boolean {
  return parse(url) !== null
}

/** Host for display, e.g. "nature.com". Empty for invalid URLs. */
export function hostOf(url: string): string {
  const u = parse(url)
  return u ? bareHost(u) : ''
}

/**
 * Decides the card kind: YouTube/Vimeo videos → video; `.pdf` paths, arXiv PDF links or an
 * `application/pdf` content type → pdf; anything else → webpage.
 */
export function detectKind(url: string, contentType?: string): ResourceKind {
  if (contentType && /^application\/pdf\b/i.test(contentType.trim())) return 'pdf'
  const u = parse(url)
  if (!u) return 'webpage'
  const host = bareHost(u)
  if (youtubeId(u)) return 'video'
  if (
    (host === 'vimeo.com' || host === 'player.vimeo.com') &&
    /^\/(video\/)?\d+/.test(u.pathname)
  ) {
    return 'video'
  }
  if (/\.pdf$/i.test(u.pathname)) return 'pdf'
  if (host === 'arxiv.org' && /^\/pdf\//.test(u.pathname)) return 'pdf'
  return 'webpage'
}

const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src)$/i

/**
 * Normalises a URL so the same resource compares equal: lowercase host without "www.",
 * no #hash, no tracking parameters, sorted query, no trailing slash. YouTube links
 * become `https://youtube.com/watch?v=<id>`. Non-http(s) input is returned trimmed.
 */
export function normalizeUrl(url: string): string {
  const u = parse(url)
  if (!u) return url.trim()

  const yt = youtubeId(u)
  if (yt) return `https://youtube.com/watch?v=${yt}`

  const params = [...u.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.test(key))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : ''
  const path = u.pathname.replace(/\/+$/, '')
  const port = u.port ? `:${u.port}` : ''
  return `${u.protocol}//${bareHost(u)}${port}${path}${query}`
}

/** A readable title from a URL's last path segment, e.g. "chapter06.pdf" → "chapter06". */
export function titleFromUrl(url: string): string {
  const u = parse(url)
  if (!u) return url.trim()
  const last = u.pathname.split('/').filter(Boolean).pop()
  if (!last) return bareHost(u)
  let name = last
  try {
    name = decodeURIComponent(last)
  } catch {
    // keep the raw segment
  }
  return (
    name
      .replace(/\.pdf$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim() || bareHost(u)
  )
}
