// The capture pipeline: page → card (with thumbnail, text, provenance link and a summary
// that arrives later), links → cards, and selected text → highlights. Dependencies are
// passed in so the whole flow can be tested without a browser.
import { absolutePosition, nodeSize } from '@shared/export/geometry'
import { detectKind, hostOf, isHttpUrl, normalizeUrl, titleFromUrl } from '@shared/kind'
import type { CanvasNode, XY } from '@shared/types'
import { addCapturedNode, addHighlight } from '@renderer/store/actions'
import { useBoardStore } from '@renderer/store/boardStore'
import type { BrowserControl } from '../browser/browserControl'
import {
  MAX_TEXT_CHARS,
  META_SCRIPT,
  SELECTION_SCRIPT,
  type PageMeta
} from '../browser/webviewScripts'
import type { CanvasControl } from '../canvas/canvasControl'
import { findFreeSpot } from '../canvas/placement'
import { cardText, cardTitle, EMPTY_META, summaryInput, uncapturableReason } from './captureHelpers'
import { nextProvenance, nodeForUrl, type Provenance, type ProvenanceEvent } from './provenance'

/** Highlights are capped so a stray Ctrl+A doesn't paste a whole page onto a card. */
export const MAX_QUOTE_CHARS = 600
const GAP = 64

export type CaptureSource = 'manual' | 'auto' | 'highlight'

export interface ToastOptions {
  action?: { label: string; onClick: () => void }
}

export interface CaptureDeps {
  browser: () => BrowserControl | null
  canvas: () => CanvasControl
  workspaceId: () => string | null
  readabilityScript: string
  saveThumb: (workspaceId: string, nodeId: string, png: string) => Promise<string>
  summarize: (text: string) => Promise<string>
  toast: (message: string, options?: ToastOptions) => void
  newId?: () => string
  now?: () => number
}

export interface Capture {
  /** The student typed an address: the next capture has no "opened from" link. */
  onTyped(): void
  /** The browser reached a page (link, back/forward, popup or redirect). */
  onNavigated(url: string): void
  /** A different workspace was opened. */
  reset(): void
  /** Captures the current page. Resolves to the card id (new or existing), or null. */
  capturePage(source?: CaptureSource): Promise<string | null>
  /** Captures a link from the current page (no thumbnail yet). */
  captureLink(url: string, text?: string, at?: XY): string | null
  /** Adds the selected text (or `text` from the context menu) to the current page's card. */
  highlight(text?: string): Promise<string | null>
}

const board = (): ReturnType<typeof useBoardStore.getState>['board'] =>
  useBoardStore.getState().board

export function createCapture(deps: CaptureDeps): Capture {
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const now = deps.now ?? (() => Date.now())
  let provenance: Provenance = { parentId: null }
  /** Counts typed addresses and resets, so a slow capture can tell if one happened. */
  let freshStarts = 0
  const inFlight = new Set<string>()

  const step = (event: ProvenanceEvent): void => {
    if (event.type === 'typed' || event.type === 'reset') freshStarts++
    provenance = nextProvenance(provenance, event, board())
  }

  /** Right of the parent card, else the middle of the view; the first free spot from there. */
  function placeNear(parentId: string | null, size = { w: 260, h: 240 }): XY {
    const b = board()
    const parent = parentId ? b.nodes[parentId] : undefined
    let near: XY
    if (parent) {
      const at = absolutePosition(parent, b)
      near = { x: at.x + nodeSize(parent).w + GAP, y: at.y }
    } else {
      const c = deps.canvas().centre()
      near = { x: c.x - size.w / 2, y: c.y - size.h / 2 }
    }
    return findFreeSpot(b, near, size)
  }

  function showExisting(id: string, source: CaptureSource): string {
    deps.canvas().select([id])
    deps.canvas().reveal([id])
    step({ type: 'captured', id })
    if (source === 'manual') deps.toast('Already on your canvas.')
    return id
  }

  function blankNode(id: string, url: string, title: string, kind: CanvasNode['kind']): CanvasNode {
    return {
      id,
      kind,
      url,
      title,
      highlights: [],
      note: '',
      comments: [],
      tags: [],
      position: { x: 0, y: 0 },
      capturedAt: now()
    }
  }

  function added(id: string, parentId: string | null, announce: boolean): void {
    deps.canvas().select([id])
    deps.canvas().reveal(parentId ? [id, parentId] : [id])
    if (announce) {
      deps.toast('Added to canvas', {
        action: { label: 'Undo', onClick: () => useBoardStore.getState().undo() }
      })
    }
  }

  async function capturePage(source: CaptureSource = 'manual'): Promise<string | null> {
    const b = deps.browser()
    if (!b || !b.isReady()) {
      if (source !== 'auto') deps.toast('The page is still loading. Try again in a moment.')
      return null
    }
    const url = b.getURL()
    const reason = uncapturableReason(url)
    if (reason) {
      if (source !== 'auto') deps.toast(reason)
      return null
    }
    const existing = nodeForUrl(board(), url)
    if (existing) return showExisting(existing, source)

    const key = normalizeUrl(url)
    if (inFlight.has(key)) return null
    inFlight.add(key)
    // Decided now: navigating while the page is being read doesn't change its parent.
    const startParent = provenance.parentId
    const startFresh = freshStarts
    try {
      const meta: PageMeta = { ...EMPTY_META, ...(await b.exec(META_SCRIPT, EMPTY_META)) }
      const kind = detectKind(url, meta.contentType)
      const article = kind === 'webpage' ? await b.exec(deps.readabilityScript, '') : ''
      const text = cardText(kind, article, meta).slice(0, MAX_TEXT_CHARS)

      // Another capture (e.g. auto mode) may have added it while we were reading.
      const again = nodeForUrl(board(), url)
      if (again) return showExisting(again, source)

      const id = newId()
      const ws = deps.workspaceId()
      const png = await b.thumbnail()
      const thumbnailPath =
        png && ws ? await deps.saveThumb(ws, id, png).catch(() => undefined) : undefined

      const parentId = startParent && board().nodes[startParent] ? startParent : null
      const node = blankNode(id, url, cardTitle(meta, url, kind), kind)
      node.position = placeNear(parentId)
      const favicon = b.favicon() || meta.favicon
      if (favicon) node.faviconUrl = favicon
      if (thumbnailPath) node.thumbnailPath = thumbnailPath
      if (text) node.text = text
      if (parentId) node.capturedFromNodeId = parentId

      if (!addCapturedNode(node, parentId)) return null
      // Become the parent of what's opened next, unless the student typed an address meanwhile.
      if (freshStarts === startFresh) step({ type: 'captured', id })
      added(id, parentId, source === 'manual')
      console.info('[capture]', { kind, source, linked: Boolean(parentId) })

      // The summary arrives later and is not an undo step of its own.
      const input = summaryInput(meta, text)
      if (input) {
        void deps
          .summarize(input)
          .then((summary) => {
            if (!summary) return
            useBoardStore.getState().patchSilently((d) => {
              if (d.nodes[id] && !d.nodes[id].summary) d.nodes[id].summary = summary
            })
          })
          .catch(() => undefined)
      }
      return id
    } finally {
      inFlight.delete(key)
    }
  }

  function captureLink(url: string, text?: string, at?: XY): string | null {
    if (!isHttpUrl(url)) {
      deps.toast('That link can’t be added.')
      return null
    }
    const existing = nodeForUrl(board(), url)
    if (existing) return showExisting(existing, 'manual')
    const kind = detectKind(url)
    const label = text?.replace(/\s+/g, ' ').trim()
    const title = label || (kind === 'pdf' ? titleFromUrl(url) : hostOf(url)) || url
    const current = deps.browser()?.getURL() ?? ''
    const parentId = nodeForUrl(board(), current)
    const node = blankNode(newId(), url, title.slice(0, 200), kind)
    node.position = at ?? placeNear(parentId)
    if (parentId) node.capturedFromNodeId = parentId
    if (!addCapturedNode(node, parentId)) return null
    added(node.id, parentId, true)
    return node.id
  }

  async function highlight(text?: string): Promise<string | null> {
    const b = deps.browser()
    const raw = text ?? (b ? await b.exec(SELECTION_SCRIPT, '') : '')
    const quote = raw.replace(/\s+/g, ' ').trim()
    if (!quote) {
      deps.toast('Select text on the page first.')
      return null
    }
    const current = b?.getURL() ?? ''
    const id = nodeForUrl(board(), current) ?? (await capturePage('highlight'))
    if (!id) return null
    if (!addHighlight(id, quote.slice(0, MAX_QUOTE_CHARS))) return null
    deps.canvas().select([id])
    deps.canvas().reveal([id])
    deps.toast('Highlight added')
    return id
  }

  return {
    onTyped: () => step({ type: 'typed' }),
    onNavigated: (url) => step({ type: 'navigated', url }),
    reset: () => step({ type: 'reset' }),
    capturePage,
    captureLink,
    highlight
  }
}
