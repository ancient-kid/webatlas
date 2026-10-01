export const SEARCH_URL = 'https://www.google.com/search?q='

const HTTP = /^https?:\/\//i
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?(\/.*)?$/i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/
const HOSTLIKE = /^[^\s/]+\.[^\s/]{2,}(:\d+)?(\/\S*)?$/

/**
 * Turns what the student typed in the address bar into a URL: web addresses get a
 * scheme (http for local ones, https otherwise); anything else becomes a search.
 */
export function toUrl(input: string): string {
  const text = input.trim()
  if (!text) return ''
  if (HTTP.test(text)) return text
  if (!/\s/.test(text)) {
    if (LOCAL.test(text) || IPV4.test(text)) return `http://${text}`
    if (HOSTLIKE.test(text) && !text.includes(':/')) return `https://${text}`
  }
  return SEARCH_URL + encodeURIComponent(text)
}
