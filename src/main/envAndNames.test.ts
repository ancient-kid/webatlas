import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiStatus, apiKey } from './env'
import { safeFileName } from './fileNames'

afterEach(() => vi.unstubAllEnvs())

describe('aiStatus', () => {
  it('reports which keys are set, as booleans only', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-secret')
    vi.stubEnv('GROQ_API_KEY', '   ')
    expect(aiStatus()).toEqual({ anthropic: true, groq: false })
    expect(JSON.stringify(aiStatus())).not.toContain('secret')
    expect(apiKey('anthropic')).toBe('sk-ant-secret')
  })
})

describe('safeFileName', () => {
  it.each([
    ['Flood finance', 'Flood finance'],
    ['a/b\\c:d*e?f"g<h>i|j', 'a b c d e f g h i j'],
    ['line\nbreak', 'line break'],
    ['trailing dots...', 'trailing dots'],
    ['', 'WebAtlas export'],
    [undefined, 'WebAtlas export']
  ])('%j → %j', (input, expected) => {
    expect(safeFileName(input)).toBe(expected)
  })

  it('caps the length', () => {
    expect(safeFileName('x'.repeat(300))).toHaveLength(100)
  })
})
