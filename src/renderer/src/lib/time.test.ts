import { describe, expect, it } from 'vitest'
import { formatOpened } from './time'

// Local time: 1 Oct 2026, 15:00.
const now = new Date(2026, 9, 1, 15, 0).getTime()
const at = (...args: [number, number, number, number?, number?]): number =>
  new Date(...(args as [number, number, number, number, number])).getTime()

describe('formatOpened', () => {
  it.each([
    ['30 seconds ago', now - 30_000, 'Opened just now'],
    ['5 minutes ago', now - 5 * 60_000, 'Opened 5 min ago'],
    ['earlier today', at(2026, 9, 1, 13, 0), 'Opened 2h ago'],
    ['yesterday evening', at(2026, 9, 0, 22, 0), 'Opened yesterday'],
    ['three days ago', at(2026, 8, 28, 10, 0), 'Opened 3 days ago'],
    ['last month', at(2026, 8, 12, 10, 0), 'Opened 12 Sep'],
    ['last year', at(2025, 11, 24, 10, 0), 'Opened 24 Dec 2025'],
    ['a clock in the future', now + 60_000, 'Opened just now']
  ])('%s → %s', (_, time, expected) => {
    expect(formatOpened(time, now)).toBe(expected)
  })
})
