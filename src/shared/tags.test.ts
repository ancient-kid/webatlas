import { describe, expect, it } from 'vitest'
import { normalizeTag } from './tags'

describe('normalizeTag', () => {
  it.each([
    ['Policy', 'policy'],
    ['  must-cite  ', 'must-cite'],
    ['#Finance', 'finance'],
    ['## To   Check ', 'to check'],
    ['   ', ''],
    ['#', '']
  ])('%j → %j', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected)
  })
})
