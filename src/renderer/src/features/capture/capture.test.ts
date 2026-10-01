// The capture pipeline and highlights, with a fake browser, canvas and API.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { makeBoard, makeQuestion } from '@shared/testing/factories'
import { useBoardStore } from '@renderer/store/boardStore'
import type { BrowserControl } from '../browser/browserControl'
import { META_SCRIPT, SELECTION_SCRIPT, type PageMeta } from '../browser/webviewScripts'
import type { CanvasControl } from '../canvas/canvasControl'
import { createCapture, MAX_QUOTE_CHARS, type CaptureDeps, type ToastOptions } from './capture'
import { EMPTY_META } from './captureHelpers'

const READABILITY = '/* readability */'

interface FakePage {
  url: string
  meta: Partial<PageMeta>
  text: string
  selection: string
  png: string | null
}

let page: FakePage
let deps: CaptureDeps & {
  toast: Mock<(message: string, options?: ToastOptions) => void>
  summarize: Mock<(text: string) => Promise<string>>
  saveThumb: Mock<(ws: string, id: string, png: string) => Promise<string>>
}
let canvasCalls: { select: string[][]; reveal: string[][] }
let ids: number

const fakeBrowser: BrowserControl = {
  isReady: () => true,
  getURL: () => page.url,
  navigate: () => undefined,
  exec: async <T>(script: string, fallback: T): Promise<T> => {
    if (script === META_SCRIPT) return { ...EMPTY_META, ...page.meta } as T
    if (script === READABILITY) return page.text as T
    if (script === SELECTION_SCRIPT) return page.selection as T
    return fallback
  },
  thumbnail: async () => page.png,
  favicon: () => undefined,
  focusAddress: () => undefined
}

const fakeCanvas: CanvasControl = {
  select: (x) => canvasCalls.select.push(x),
  reveal: (x) => canvasCalls.reveal.push(x),
  zoomTo: () => undefined,
  centre: () => ({ x: 1000, y: 1000 })
}

const b = (): ReturnType<typeof useBoardStore.getState>['board'] => useBoardStore.getState().board
const pages = (): ReturnType<typeof b>['nodes'][string][] =>
  Object.values(b().nodes).filter((n) => n.kind !== 'question')

beforeEach(() => {
  useBoardStore.getState().load(makeBoard({ nodes: [makeQuestion({ position: { x: 0, y: 0 } })] }))
  page = {
    url: 'https://example.org/article',
    meta: { title: 'Green bonds', description: 'How cities borrow.' },
    text: 'Article text '.repeat(30),
    selection: '',
    png: 'data:image/png;base64,AAAA'
  }
  canvasCalls = { select: [], reveal: [] }
  ids = 0
  deps = {
    browser: () => fakeBrowser,
    canvas: () => fakeCanvas,
    workspaceId: () => 'ws-1',
    readabilityScript: READABILITY,
    saveThumb: vi.fn(async (_ws: string, id: string) => `wa-thumb://ws-1/${id}.png?v=1`),
    summarize: vi.fn(async () => 'One-line summary.'),
    toast: vi.fn<(message: string, options?: ToastOptions) => void>(),
    newId: () => `id-${++ids}`,
    now: () => 1234
  }
})

describe('capturePage', () => {
  it('creates a card with title, text, thumbnail and (later) a summary, as one undo step', async () => {
    const capture = createCapture(deps)
    const id = await capture.capturePage('manual')
    expect(id).toBe('id-1')
    expect(b().nodes[id!]).toMatchObject({
      kind: 'webpage',
      url: 'https://example.org/article',
      title: 'Green bonds',
      thumbnailPath: 'wa-thumb://ws-1/id-1.png?v=1',
      capturedAt: 1234
    })
    expect(b().nodes[id!].text!.length).toBeGreaterThan(200)
    expect(useBoardStore.getState().past).toHaveLength(1)
    expect(deps.toast).toHaveBeenCalledWith(
      'Added to canvas',
      expect.objectContaining({ action: expect.anything() })
    )
    expect(canvasCalls.select).toEqual([['id-1']])
    await vi.waitFor(() => expect(b().nodes[id!].summary).toBe('One-line summary.'))
    expect(useBoardStore.getState().past).toHaveLength(1) // the summary is not an undo step
    expect(deps.summarize).toHaveBeenCalledWith(
      expect.stringMatching(/^How cities borrow\.\nArticle text/)
    )
  })

  it('a page opened from a captured page gets an "opened from" link in the same undo step', async () => {
    const capture = createCapture(deps)
    const first = await capture.capturePage('manual')
    page.url = 'https://example.org/linked'
    capture.onNavigated(page.url)
    const second = await capture.capturePage('manual')
    expect(b().nodes[second!].capturedFromNodeId).toBe(first)
    expect(Object.values(b().edges)).toEqual([
      expect.objectContaining({
        source: first,
        target: second,
        relation: 'opened-from',
        origin: 'provenance'
      })
    ])
    useBoardStore.getState().undo()
    expect(b().nodes[second!]).toBeUndefined()
    expect(Object.keys(b().edges)).toEqual([])
    // Placed to the right of its parent.
    useBoardStore.getState().redo()
    expect(b().nodes[second!].position.x).toBeGreaterThan(b().nodes[first!].position.x)
  })

  it('a typed address has no "opened from" link', async () => {
    const capture = createCapture(deps)
    await capture.capturePage('manual')
    capture.onTyped()
    page.url = 'https://typed.org/'
    capture.onNavigated(page.url)
    await capture.capturePage('manual')
    expect(Object.keys(b().edges)).toEqual([])
  })

  it('capturing the same page again selects the existing card instead', async () => {
    const capture = createCapture(deps)
    const id = await capture.capturePage('manual')
    page.url = 'https://example.org/article/#comments'
    expect(await capture.capturePage('manual')).toBe(id)
    expect(pages()).toHaveLength(1)
    expect(deps.toast).toHaveBeenLastCalledWith('Already on your canvas.')
  })

  it('two captures at once of the same page make one card', async () => {
    const capture = createCapture(deps)
    await Promise.all([capture.capturePage('auto'), capture.capturePage('auto')])
    expect(pages()).toHaveLength(1)
  })

  it('kinds: PDF by content type (title from the file name), video with its description', async () => {
    const capture = createCapture(deps)
    page = {
      ...page,
      url: 'https://x.org/files/sea_walls.pdf',
      meta: { contentType: 'application/pdf' }
    }
    const pdf = await capture.capturePage('manual')
    expect(b().nodes[pdf!]).toMatchObject({ kind: 'pdf', title: 'sea walls' })
    page = {
      ...page,
      url: 'https://youtu.be/abc123',
      meta: { title: 'Rotterdam', description: 'A talk.' }
    }
    const video = await capture.capturePage('manual')
    expect(b().nodes[video!]).toMatchObject({ kind: 'video', text: 'A talk.' })
  })

  it('refuses search results and blank pages with a toast (silently in auto mode)', async () => {
    const capture = createCapture(deps)
    page.url = 'https://www.google.com/search?q=x'
    expect(await capture.capturePage('manual')).toBeNull()
    expect(deps.toast).toHaveBeenCalledWith('Open a result first, then add it.')
    page.url = 'about:blank'
    expect(await capture.capturePage('auto')).toBeNull()
    expect(deps.toast).toHaveBeenCalledTimes(1)
    expect(pages()).toHaveLength(0)
  })

  it('still creates the card when the thumbnail, text and summary all fail', async () => {
    deps.saveThumb.mockRejectedValue(new Error('disk'))
    deps.summarize.mockRejectedValue(new Error('offline'))
    page.text = ''
    const id = await createCapture(deps).capturePage('manual')
    expect(b().nodes[id!].thumbnailPath).toBeUndefined()
    expect(b().nodes[id!].title).toBe('Green bonds')
  })
})

describe('captureLink', () => {
  it('adds a card for the link, opened from the current page’s card, at a given spot', async () => {
    const capture = createCapture(deps)
    const from = await capture.capturePage('manual')
    const id = capture.captureLink('https://example.org/report.pdf', ' The report ', {
      x: 64,
      y: 96
    })
    expect(b().nodes[id!]).toMatchObject({
      kind: 'pdf',
      title: 'The report',
      position: { x: 64, y: 96 },
      capturedFromNodeId: from
    })
    expect(b().nodes[id!].thumbnailPath).toBeUndefined()
    expect(Object.values(b().edges)).toHaveLength(1)
  })

  it('refuses non-web links', () => {
    expect(createCapture(deps).captureLink('javascript:alert(1)')).toBeNull()
    expect(pages()).toHaveLength(0)
  })
})

describe('highlight', () => {
  it('an empty selection shows a toast and changes nothing', async () => {
    page.selection = '   '
    expect(await createCapture(deps).highlight()).toBeNull()
    expect(deps.toast).toHaveBeenCalledWith('Select text on the page first.')
    expect(useBoardStore.getState().past).toHaveLength(0)
  })

  it('a page not on the canvas is captured first, then gets the highlight', async () => {
    page.selection = 'Insurance pools shift cost to the state.'
    const id = await createCapture(deps).highlight()
    expect(b().nodes[id!].highlights.map((h) => h.quote)).toEqual([
      'Insurance pools shift cost to the state.'
    ])
    expect(useBoardStore.getState().past).toHaveLength(2) // capture, then highlight
    useBoardStore.getState().undo()
    expect(b().nodes[id!].highlights).toEqual([])
  })

  it('uses the context menu’s text when given, and caps quotes at 600 characters', async () => {
    const capture = createCapture(deps)
    const id = await capture.capturePage('manual')
    await capture.highlight('word '.repeat(400))
    const quote = b().nodes[id!].highlights[0].quote
    expect(quote.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS)
    expect(quote.length).toBeGreaterThan(MAX_QUOTE_CHARS - 5)
    expect(deps.toast).toHaveBeenLastCalledWith('Highlight added')
  })
})

describe('provenance races', () => {
  it('typing an address while a capture is still reading the page starts afresh', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const slow: BrowserControl = {
      ...fakeBrowser,
      thumbnail: async () => {
        await gate
        return page.png
      }
    }
    const capture = createCapture({ ...deps, browser: () => slow })
    const first = capture.capturePage('manual')
    capture.onTyped() // the student typed a new address before the capture finished
    release()
    await first
    page.url = 'https://typed.org/'
    capture.onNavigated(page.url)
    await capture.capturePage('manual')
    expect(Object.keys(b().edges)).toEqual([])
  })
})
