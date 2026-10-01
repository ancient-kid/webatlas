import { describe, expect, it } from 'vitest'
import { SessionSchema } from './schema'
import {
  clampSplitRatio,
  defaultSession,
  SPLIT_RATIO_DEFAULT,
  SPLIT_RATIO_MAX,
  SPLIT_RATIO_MIN
} from './session'

describe('defaultSession', () => {
  it('opens the browser pane at the default width, in manual capture and graph view', () => {
    expect(defaultSession()).toEqual({
      viewport: { x: 400, y: 300, zoom: 1 },
      selectedIds: [],
      browserUrl: 'https://www.google.com',
      viewMode: 'graph',
      captureMode: 'manual',
      browserOpen: true,
      splitRatio: SPLIT_RATIO_DEFAULT
    })
  })

  it('is valid against the schema', () => {
    expect(SessionSchema.safeParse(defaultSession()).success).toBe(true)
  })

  it('returns a fresh object each time', () => {
    const a = defaultSession()
    a.selectedIds.push('x')
    expect(defaultSession().selectedIds).toEqual([])
  })
})

describe('clampSplitRatio', () => {
  it('keeps values inside the limits', () => {
    expect(clampSplitRatio(42)).toBe(42)
    expect(clampSplitRatio(SPLIT_RATIO_MIN)).toBe(SPLIT_RATIO_MIN)
    expect(clampSplitRatio(SPLIT_RATIO_MAX)).toBe(SPLIT_RATIO_MAX)
  })

  it('clamps values outside the limits', () => {
    expect(clampSplitRatio(3)).toBe(SPLIT_RATIO_MIN)
    expect(clampSplitRatio(99)).toBe(SPLIT_RATIO_MAX)
    expect(clampSplitRatio(-10)).toBe(SPLIT_RATIO_MIN)
  })

  it('rounds to one decimal place', () => {
    expect(clampSplitRatio(33.3333)).toBe(33.3)
  })

  it('falls back to the default for non-numbers', () => {
    expect(clampSplitRatio(NaN)).toBe(SPLIT_RATIO_DEFAULT)
    expect(clampSplitRatio(Infinity)).toBe(SPLIT_RATIO_DEFAULT)
  })
})
