/** Tags are stored lowercased and trimmed, without a leading "#", single-spaced. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase()
}
