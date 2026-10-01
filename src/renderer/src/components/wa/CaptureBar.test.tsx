// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CaptureBar, type CaptureBarProps } from './CaptureBar'

const setup = (
  p: Partial<CaptureBarProps> = {}
): Required<
  Pick<
    CaptureBarProps,
    'onModeChange' | 'onNavigate' | 'onAdd' | 'onBack' | 'onForward' | 'onReload'
  >
> => {
  const h = {
    onModeChange: vi.fn(),
    onNavigate: vi.fn(),
    onAdd: vi.fn(),
    onBack: vi.fn(),
    onForward: vi.fn(),
    onReload: vi.fn()
  }
  render(
    <CaptureBar url="https://example.com/" mode="manual" canGoBack canGoForward {...h} {...p} />
  )
  return h
}

describe('CaptureBar', () => {
  it('Manual/Auto toggle shows the mode and calls onModeChange', async () => {
    const h = setup()
    expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Manual' }))
    expect(h.onModeChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Auto' }))
    expect(h.onModeChange).toHaveBeenCalledWith('auto')
  })

  it('Enter in the address field calls onNavigate with the typed text', async () => {
    const h = setup()
    const input = screen.getByRole('textbox', { name: 'Address' })
    expect(input).toHaveValue('https://example.com/')
    await userEvent.click(input)
    await userEvent.keyboard('{Control>}a{/Control}  climate adaptation {Enter}')
    expect(h.onNavigate).toHaveBeenCalledWith('climate adaptation')
  })

  it('Escape abandons the typed text', async () => {
    const h = setup()
    const input = screen.getByRole('textbox', { name: 'Address' })
    await userEvent.click(input)
    await userEvent.keyboard('{Control>}a{/Control}typo{Escape}')
    expect(h.onNavigate).not.toHaveBeenCalled()
    expect(input).toHaveValue('https://example.com/')
  })

  it('back, forward, reload and Add to canvas fire', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Forward' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await userEvent.click(screen.getByRole('button', { name: /Add to canvas/ }))
    for (const fn of [h.onBack, h.onForward, h.onReload, h.onAdd]) {
      expect(fn).toHaveBeenCalledTimes(1)
    }
    expect(screen.getByText('Alt+A')).toHaveClass('wa-kbd')
  })

  it('back and forward are disabled when there is no history', () => {
    setup({ canGoBack: false, canGoForward: false })
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled()
  })
})
