import { expect, test } from '@playwright/test'

test.describe('fixture web server', () => {
  for (const page of ['article.html', 'linked.html', 'third.html']) {
    test(`serves ${page} as HTML`, async ({ request }) => {
      const res = await request.get(`/${page}`)
      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('text/html')
      expect(await res.text()).toContain('<article>')
    })
  }

  test('serves doc.pdf as a PDF', async ({ request }) => {
    const res = await request.get('/doc.pdf')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('application/pdf')
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  test('article has the metadata capture relies on', async ({ request }) => {
    const html = await (await request.get('/article.html')).text()
    expect(html).toContain('property="og:title"')
    expect(html).toContain('name="description"')
    expect(html).toContain('target="_blank"')
  })

  test('returns 404 for unknown files and rejects path traversal', async ({ request }) => {
    expect((await request.get('/nope.html')).status()).toBe(404)
    expect((await request.get('/..%2Fserver.mjs')).status()).not.toBe(200)
  })
})
