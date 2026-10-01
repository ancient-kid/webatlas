// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_TEXT_CHARS,
  META_SCRIPT,
  SELECTION_SCRIPT,
  readabilityScript,
  type PageMeta
} from './webviewScripts'

const fixture = (name: string): string =>
  readFileSync(resolve(__dirname, '../../../../../e2e/fixtures/site', name), 'utf8')
const readabilitySource = readFileSync(
  resolve(__dirname, '../../../../../node_modules/@mozilla/readability/Readability.js'),
  'utf8'
)

/** Replaces the jsdom document with a fixture page. */
function loadPage(html: string): void {
  document.open()
  document.write(html)
  document.close()
}

/** Evaluates a page script in global scope, like executeJavaScript does. */
function runInPage<T>(script: string): T {
  return (0, eval)(script) as T
}

beforeEach(() => {
  window.getSelection()?.removeAllRanges()
})

describe('META_SCRIPT', () => {
  it('reads title, Open Graph fields, description and absolute URLs', () => {
    loadPage(fixture('article.html'))
    const meta = runInPage<PageMeta>(META_SCRIPT)
    expect(meta.title).toBe('Green bonds and coastal adaptation | Fixture Journal')
    expect(meta.ogTitle).toBe('Green bonds and coastal adaptation')
    expect(meta.siteName).toBe('Fixture Journal')
    expect(meta.description).toMatch(/^How coastal cities use green bonds/)
    expect(meta.ogImage).toBe(new URL('/cover.svg', location.href).href)
    expect(meta.favicon).toBe(new URL('/favicon.ico', location.href).href)
    expect(meta.contentType).toBe('text/html')
  })

  it('returns empty Open Graph fields when a page has none', () => {
    loadPage(fixture('third.html'))
    const meta = runInPage<PageMeta>(META_SCRIPT)
    expect(meta.ogTitle).toBe('')
    expect(meta.ogImage).toBe('')
    expect(meta.siteName).toBe('')
    expect(meta.title).toBe('OECD overview: financing climate adaptation in cities')
    expect(meta.description).toMatch(/^An overview of public and private finance/)
  })

  it('falls back to og:description and to /favicon.ico', () => {
    loadPage(
      '<html><head><title> Spaced title </title><meta property="og:description" content="OG only"></head><body></body></html>'
    )
    const meta = runInPage<PageMeta>(META_SCRIPT)
    expect(meta.title).toBe('Spaced title')
    expect(meta.description).toBe('OG only')
    expect(meta.favicon).toBe(`${location.origin}/favicon.ico`)
  })

  it('returns only JSON-serialisable data', () => {
    loadPage(fixture('article.html'))
    const meta = runInPage<PageMeta>(META_SCRIPT)
    expect(JSON.parse(JSON.stringify(meta))).toEqual(meta)
  })
})

describe('readabilityScript', () => {
  it('extracts the article text with whitespace collapsed', () => {
    loadPage(fixture('article.html'))
    const text = runInPage<string>(readabilityScript(readabilitySource))
    expect(text.length).toBeGreaterThan(200)
    expect(text).toContain('Rotterdam pioneered water squares')
    expect(text).not.toMatch(/\s{2,}/)
  })

  it('leaves the live page untouched', () => {
    loadPage(fixture('article.html'))
    const before = document.body.innerHTML
    runInPage<string>(readabilityScript(readabilitySource))
    expect(document.body.innerHTML).toBe(before)
  })

  it('caps the text length', () => {
    const para = `<p>${'Adaptation finance matters for coastal cities. '.repeat(40)}</p>`
    loadPage(
      `<html><head><title>Long</title></head><body><article>${para.repeat(20)}</article></body></html>`
    )
    const text = runInPage<string>(readabilityScript(readabilitySource))
    expect(text.length).toBe(MAX_TEXT_CHARS)
  })

  it('returns an empty string instead of throwing when extraction fails', () => {
    loadPage(fixture('article.html'))
    expect(
      runInPage<string>(readabilityScript('throw new Error("blocked by Trusted Types")'))
    ).toBe('')
  })
})

describe('SELECTION_SCRIPT', () => {
  it('returns the selected text, trimmed', () => {
    loadPage(fixture('article.html'))
    const lead = document.getElementById('lead')!
    const range = document.createRange()
    range.selectNodeContents(lead)
    window.getSelection()!.addRange(range)
    const selected = runInPage<string>(SELECTION_SCRIPT)
    expect(selected).toMatch(/^Coastal cities fund climate adaptation/)
    expect(selected).toBe(selected.trim())
  })

  it('returns an empty string when nothing is selected', () => {
    loadPage(fixture('article.html'))
    expect(runInPage<string>(SELECTION_SCRIPT)).toBe('')
  })
})
