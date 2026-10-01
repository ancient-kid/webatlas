import { describe, expect, it } from 'vitest'
import { errorMessage } from '@renderer/lib/errors'
import { SEARCH_URL, toUrl } from './toUrl'

describe('toUrl', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['en.wikipedia.org/wiki/Green_bond', 'https://en.wikipedia.org/wiki/Green_bond'],
    ['http://x.org', 'http://x.org'],
    ['HTTPS://Example.com/Path', 'HTTPS://Example.com/Path'],
    ['localhost:3000', 'http://localhost:3000'],
    ['localhost', 'http://localhost'],
    ['127.0.0.1:4599/article.html', 'http://127.0.0.1:4599/article.html'],
    ['  wikipedia.org  ', 'https://wikipedia.org']
  ])('%j → %s', (input, expected) => {
    expect(toUrl(input)).toBe(expected)
  })

  it.each([
    ['climate adaptation', 'climate%20adaptation'],
    ['sea level rise', 'sea%20level%20rise'],
    ['adaptation', 'adaptation'],
    ['javascript:alert(1)', 'javascript%3Aalert(1)'],
    ['what is 2.5 degrees', 'what%20is%202.5%20degrees']
  ])('%j becomes a Google search', (input, query) => {
    expect(toUrl(input)).toBe(SEARCH_URL + query)
  })

  it('empty input gives nothing', () => {
    expect(toUrl('   ')).toBe('')
  })
})

describe('errorMessage', () => {
  it('drops Electron’s IPC prefix', () => {
    const err = new Error(
      "Error invoking remote method 'import:workspace': Error: This file isn't a WebAtlas workspace"
    )
    expect(errorMessage(err)).toBe("This file isn't a WebAtlas workspace")
    expect(errorMessage('plain')).toBe('plain')
  })
})
