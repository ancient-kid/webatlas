// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, type ButtonVariant } from './Button'

describe('Button', () => {
  it.each<ButtonVariant>(['secondary', 'primary', 'ghost', 'accept', 'reject'])(
    'variant %s gets its class',
    (variant) => {
      render(<Button variant={variant}>Go</Button>)
      expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('wa-btn', `wa-btn--${variant}`)
    }
  )

  it('defaults to a secondary, medium, type="button" button', () => {
    render(<Button>Export</Button>)
    const b = screen.getByRole('button', { name: 'Export' })
    expect(b).toHaveClass('wa-btn--secondary')
    expect(b).not.toHaveClass('wa-btn--sm')
    expect(b).toHaveAttribute('type', 'button')
  })

  it('small size, icon and keyboard hint chip', () => {
    const { container } = render(
      <Button size="sm" icon="plus" kbd="Alt+A">
        Add to canvas
      </Button>
    )
    expect(screen.getByRole('button')).toHaveClass('wa-btn--sm')
    expect(container.querySelector('svg.wa-icon')).not.toBeNull()
    expect(screen.getByText('Alt+A')).toHaveClass('wa-kbd')
  })

  it('calls onClick, but not when disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    )
    expect(screen.getByRole('button')).toBeDisabled()
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('passes through extra attributes such as aria-label', () => {
    render(<Button icon="search" aria-label="Search the board" />)
    expect(screen.getByRole('button', { name: 'Search the board' })).toBeInTheDocument()
  })
})
