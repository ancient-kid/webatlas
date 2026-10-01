// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HINTS_SEEN_KEY, HintOverlay } from './HintOverlay'

describe('HintOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('is shown when not yet seen', () => {
    render(<HintOverlay />)
    expect(screen.getByText("Add the page you're reading. Alt+A")).toBeInTheDocument()
    expect(screen.getByText('Double-click empty space to write a note')).toBeInTheDocument()
    expect(screen.getByText('Got it')).toBeInTheDocument()
  })

  it('clicking "Got it" hides the overlay and remembers in localStorage', async () => {
    const user = userEvent.setup()
    render(<HintOverlay />)

    const gotIt = screen.getByRole('button', { name: 'Got it' })
    await user.click(gotIt)

    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
    expect(localStorage.getItem(HINTS_SEEN_KEY)).toBe('1')
  })

  it('is not shown if already seen', () => {
    localStorage.setItem(HINTS_SEEN_KEY, '1')
    render(<HintOverlay />)
    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
  })

  it('handles storage throwing without crashing', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Access denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: Access denied')
    })

    render(<HintOverlay />)
    expect(screen.getByText('Got it')).toBeInTheDocument()

    const gotIt = screen.getByRole('button', { name: 'Got it' })
    await user.click(gotIt)

    // Should dismiss without unhandled exception
    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
  })
})
