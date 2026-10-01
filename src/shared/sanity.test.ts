import { describe, expect, it } from 'vitest'

describe('unit test harness', () => {
  it('runs in the node environment', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof process.versions.node).toBe('string')
  })
})
