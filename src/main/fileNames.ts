/** A safe file name: no path separators or characters Windows forbids. */
export function safeFileName(name: unknown): string {
  const cleaned = Array.from(String(name ?? ''), (ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
    .join('')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 100)
  return cleaned || 'WebAtlas export'
}
