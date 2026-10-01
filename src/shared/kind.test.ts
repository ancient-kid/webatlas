import { describe, expect, it } from 'vitest'
import { detectKind, hostOf, isHttpUrl, normalizeUrl, titleFromUrl } from './kind'

describe('detectKind', () => {
  it.each([
    ['YouTube watch', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'],
    ['YouTube watch with extra params', 'https://youtube.com/watch?v=aqz-KE-bpKQ&t=30s&list=PL1'],
    ['youtu.be short link', 'https://youtu.be/aqz-KE-bpKQ?t=5'],
    ['mobile YouTube', 'https://m.youtube.com/watch?v=aqz-KE-bpKQ'],
    ['YouTube Shorts', 'https://www.youtube.com/shorts/abc123XYZ'],
    ['Vimeo numeric', 'https://vimeo.com/76979871'],
    ['Vimeo player', 'https://player.vimeo.com/video/76979871']
  ])('%s → video', (_label, url) => {
    expect(detectKind(url)).toBe('video')
  })

  it.each([
    ['YouTube channel page', 'https://www.youtube.com/@blender'],
    ['YouTube home', 'https://www.youtube.com/'],
    ['Vimeo profile', 'https://vimeo.com/blender'],
    ['Wikipedia', 'https://en.wikipedia.org/wiki/Climate_change_adaptation'],
    ['arXiv abstract', 'https://arxiv.org/abs/2106.09685'],
    ['plain site', 'https://www.bbc.com/news']
  ])('%s → webpage', (_label, url) => {
    expect(detectKind(url)).toBe('webpage')
  })

  it.each([
    ['.pdf path', 'https://ipcc.ch/report/ar6/wg2/chapter06.pdf'],
    ['upper-case .PDF with a query', 'https://example.org/files/REPORT.PDF?x=1#page=3'],
    ['arXiv PDF link without extension', 'https://arxiv.org/pdf/2106.09685']
  ])('%s → pdf', (_label, url) => {
    expect(detectKind(url)).toBe('pdf')
  })

  it('uses an application/pdf content type even without a .pdf extension', () => {
    expect(detectKind('https://example.org/download?id=7', 'application/pdf')).toBe('pdf')
    expect(detectKind('https://example.org/download?id=7', 'Application/PDF; charset=binary')).toBe(
      'pdf'
    )
  })

  it('does not treat pdf-looking text elsewhere in the URL as a PDF', () => {
    expect(detectKind('https://example.org/pdf-guide?format=pdf')).toBe('webpage')
    expect(detectKind('https://example.org/page', 'text/html')).toBe('webpage')
  })

  it('treats invalid and non-http URLs as webpages', () => {
    expect(detectKind('not a url')).toBe('webpage')
    expect(detectKind('file:///C:/notes.pdf')).toBe('webpage')
    expect(detectKind('')).toBe('webpage')
  })
})

describe('normalizeUrl', () => {
  it('drops the #hash', () => {
    expect(normalizeUrl('https://example.com/a#section-2')).toBe('https://example.com/a')
  })

  it('drops utm_* and other tracking parameters but keeps real ones', () => {
    expect(
      normalizeUrl('https://example.com/a?utm_source=x&id=7&utm_campaign=y&fbclid=z&gclid=q')
    ).toBe('https://example.com/a?id=7')
  })

  it('drops a trailing slash, including on the root', () => {
    expect(normalizeUrl('https://example.com/a/b/')).toBe('https://example.com/a/b')
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
  })

  it('lowercases the host and strips www., but keeps the path case', () => {
    expect(normalizeUrl('https://WWW.Example.COM/Wiki/Green_Bond')).toBe(
      'https://example.com/Wiki/Green_Bond'
    )
  })

  it('sorts query parameters so their order does not matter', () => {
    expect(normalizeUrl('https://example.com/s?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/s?a=1&b=2')
    )
  })

  it('keeps the protocol and a non-default port', () => {
    expect(normalizeUrl('http://localhost:4599/article.html')).toBe(
      'http://localhost:4599/article.html'
    )
    expect(normalizeUrl('https://example.com:443/x')).toBe('https://example.com/x')
  })

  it('reduces every YouTube link form to one canonical watch URL (keeps only v=)', () => {
    const canonical = 'https://youtube.com/watch?v=aqz-KE-bpKQ'
    expect(normalizeUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30s&list=PL1')).toBe(
      canonical
    )
    expect(normalizeUrl('https://youtu.be/aqz-KE-bpKQ?si=abc')).toBe(canonical)
    expect(normalizeUrl('https://m.youtube.com/watch?v=aqz-KE-bpKQ#comments')).toBe(canonical)
  })

  it('makes the variants of the same page equal', () => {
    const variants = [
      'https://www.nature.com/articles/s41558/',
      'https://nature.com/articles/s41558#abstract',
      'https://nature.com/articles/s41558?utm_source=twitter'
    ]
    expect(new Set(variants.map(normalizeUrl)).size).toBe(1)
  })

  it('returns non-http input trimmed and unchanged', () => {
    expect(normalizeUrl('  about:blank ')).toBe('about:blank')
    expect(normalizeUrl('not a url')).toBe('not a url')
  })
})

describe('hostOf', () => {
  it('returns the lowercased host without www.', () => {
    expect(hostOf('https://WWW.Nature.com/articles/x')).toBe('nature.com')
    expect(hostOf('https://en.wikipedia.org/wiki/X')).toBe('en.wikipedia.org')
    expect(hostOf('http://127.0.0.1:4599/a')).toBe('127.0.0.1')
  })

  it('returns an empty string for invalid or non-http URLs', () => {
    expect(hostOf('nope')).toBe('')
    expect(hostOf('about:blank')).toBe('')
  })
})

describe('isHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(isHttpUrl('https://a.org')).toBe(true)
    expect(isHttpUrl('http://a.org')).toBe(true)
    expect(isHttpUrl('ftp://a.org')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('a.org')).toBe(false)
  })
})

describe('titleFromUrl', () => {
  it('turns a PDF file name into a readable title', () => {
    expect(titleFromUrl('https://ipcc.ch/report/ar6/wg2/IPCC_AR6-WGII_Chapter06.pdf')).toBe(
      'IPCC AR6 WGII Chapter06'
    )
    expect(titleFromUrl('https://arxiv.org/pdf/2106.09685')).toBe('2106.09685')
  })

  it('decodes escaped characters', () => {
    expect(titleFromUrl('https://example.org/files/Climate%20finance.pdf')).toBe('Climate finance')
  })

  it('falls back to the host when there is no path', () => {
    expect(titleFromUrl('https://www.example.org/')).toBe('example.org')
  })
})
