// Provenance ("opened from") and the pure capture rules.
import { describe, expect, it } from 'vitest'
import { makeBoard, makeNode } from '@shared/testing/factories'
import {
  EMPTY_META,
  cardText,
  cardTitle,
  isCapturable,
  summaryInput,
  uncapturableReason
} from './captureHelpers'
import { nextProvenance, nodeForUrl } from './provenance'

const board = makeBoard({
  nodes: [
    makeNode({ id: 'a', url: 'https://www.example.com/a/' }),
    makeNode({ id: 'n', kind: 'note', url: undefined, title: 'note' })
  ]
})

describe('provenance', () => {
  it('a typed address starts afresh', () => {
    expect(nextProvenance({ parentId: 'a' }, { type: 'typed' }, board)).toEqual({ parentId: null })
  })

  it('following a link keeps the parent', () => {
    expect(
      nextProvenance({ parentId: 'a' }, { type: 'navigated', url: 'https://other.org/x' }, board)
    ).toEqual({ parentId: 'a' })
  })

  it('revisiting a captured page makes that card the parent (URL variants match)', () => {
    expect(
      nextProvenance(
        { parentId: null },
        { type: 'navigated', url: 'https://example.com/a#section?utm_source=x' },
        board
      )
    ).toEqual({ parentId: 'a' })
  })

  it('a capture becomes the parent; a deleted parent is forgotten', () => {
    expect(nextProvenance({ parentId: null }, { type: 'captured', id: 'z' }, board)).toEqual({
      parentId: 'z'
    })
    expect(
      nextProvenance({ parentId: 'gone' }, { type: 'navigated', url: 'https://x.org' }, board)
    ).toEqual({ parentId: null })
  })

  it('nodeForUrl ignores notes and empty URLs', () => {
    expect(nodeForUrl(board, 'https://example.com/a')).toBe('a')
    expect(nodeForUrl(board, '')).toBeNull()
  })
})

describe('capture rules', () => {
  it.each([
    ['about:blank', 'Open a page first, then add it.'],
    ['', 'Open a page first, then add it.'],
    ['https://www.google.com/search?q=sea+walls', 'Open a result first, then add it.'],
    ['https://www.google.co.uk/search?q=x', 'Open a result first, then add it.'],
    ['https://www.google.com/', 'Open a result first, then add it.'],
    ['file:///C:/secret.txt', 'Open a page first, then add it.']
  ])('%j is not capturable', (url, reason) => {
    expect(uncapturableReason(url)).toBe(reason)
    expect(isCapturable(url)).toBe(false)
  })

  it.each([
    'https://en.wikipedia.org/wiki/Green_bond',
    'https://scholar.google.com/x',
    'http://127.0.0.1:4599/a.html'
  ])('%s is capturable', (url) => expect(isCapturable(url)).toBe(true))

  it('title: og:title, then <title>, then the PDF file name or the host', () => {
    const url = 'https://ipcc.ch/report/ar6/chapter_06.pdf'
    expect(cardTitle({ ...EMPTY_META, ogTitle: 'OG', title: 'T' }, url, 'webpage')).toBe('OG')
    expect(cardTitle({ ...EMPTY_META, title: '  Page   title ' }, url, 'webpage')).toBe(
      'Page title'
    )
    expect(cardTitle(EMPTY_META, url, 'pdf')).toBe('chapter 06')
    expect(cardTitle(EMPTY_META, 'https://www.example.com/x', 'webpage')).toBe('example.com')
    expect(cardTitle({ ...EMPTY_META, title: 'x'.repeat(500) }, url, 'webpage')).toHaveLength(200)
  })

  it('videos keep their description as text; pages their article text', () => {
    const meta = { ...EMPTY_META, description: 'About the video' }
    expect(cardText('video', '', meta)).toBe('About the video')
    expect(cardText('webpage', 'Article', meta)).toBe('Article')
  })

  it('summary input is the description then the text, capped at 3000 characters', () => {
    expect(summaryInput({ ...EMPTY_META, description: ' Desc ' }, ' Body ')).toBe('Desc\nBody')
    expect(summaryInput(EMPTY_META, 'y'.repeat(5000))).toHaveLength(3000)
    expect(summaryInput(EMPTY_META, '  ')).toBe('')
  })
})
