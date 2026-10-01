// @vitest-environment jsdom
// ViewSwitcher, WorkspaceCard and the CommandPaletteView shell.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CommandPaletteView } from './CommandPaletteView'
import { ViewSwitcher } from './ViewSwitcher'
import { WorkspaceCard } from './WorkspaceCard'

describe('ViewSwitcher', () => {
  it('aria-pressed follows the value; a click calls onChange', async () => {
    const onChange = vi.fn()
    render(<ViewSwitcher value="graph" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Graph' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Focus' }))
    await userEvent.click(screen.getByRole('button', { name: 'Graph' })) // already active
    expect(onChange.mock.calls).toEqual([['focus']])
  })

  it('hidden views are not rendered', () => {
    render(<ViewSwitcher value="list" views={['graph', 'list']} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Graph', 'List'])
  })
})

describe('WorkspaceCard', () => {
  const now = new Date(2026, 9, 1, 15).getTime()

  it('shows the name, question, counts and relative time', () => {
    render(
      <WorkspaceCard
        name="Flood finance"
        question="How do coastal cities fund adaptation?"
        nodes={24}
        groups={1}
        updatedAt={now - 2 * 3_600_000}
        now={now}
      />
    )
    expect(screen.getByRole('heading', { name: 'Flood finance' })).toHaveClass('wa-ws__name')
    expect(screen.getByText('How do coastal cities fund adaptation?')).toBeInTheDocument()
    expect(screen.getByText('24 nodes · 1 group')).toBeInTheDocument()
    expect(screen.getByText('Opened 2h ago')).toBeInTheDocument()
  })

  it('uses the cover image when present, else the decorative map', () => {
    const { container, rerender } = render(
      <WorkspaceCard name="A" nodes={0} groups={0} updatedAt={now} now={now} />
    )
    expect(container.querySelector('.wa-ws__map svg')).not.toBeNull()
    rerender(
      <WorkspaceCard
        name="A"
        nodes={0}
        groups={0}
        updatedAt={now}
        now={now}
        coverThumb="wa-thumb://w/n.png"
      />
    )
    expect(container.querySelector('.wa-ws__map img')).toHaveAttribute('src', 'wa-thumb://w/n.png')
  })

  it('clicking opens it; the menu is a separate control', async () => {
    const onOpen = vi.fn()
    const onMenu = vi.fn()
    render(
      <WorkspaceCard
        name="Flood finance"
        nodes={0}
        groups={0}
        updatedAt={now}
        now={now}
        onOpen={onOpen}
        menu={
          <button type="button" onClick={onMenu}>
            Menu
          </button>
        }
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open Flood finance' }))
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onMenu).toHaveBeenCalledTimes(1)
  })
})

describe('CommandPaletteView', () => {
  it('shows the query, rows with what matched, the active row and the footer', () => {
    const { container } = render(
      <CommandPaletteView
        query="rotterdam"
        active={1}
        results={[
          { type: 'video', title: 'Rotterdam: living with water', match: 'Title · youtube.com' },
          { type: 'tag', title: '#rotterdam', match: 'Tag · 3 nodes' }
        ]}
      />
    )
    expect(screen.getByRole('dialog', { name: 'Search workspace' })).toBeInTheDocument()
    expect(screen.getByText('rotterdam')).toBeInTheDocument()
    const rows = container.querySelectorAll('.wa-pal__row')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveClass('wa-pal__row--on')
    expect(screen.getByText('Tag · 3 nodes')).toHaveClass('wa-pal__m')
    expect(container.querySelector('.wa-pal__foot')).toHaveTextContent(
      '↑↓ to moveEnter to jump to nodeSearches titles, URLs, notes, highlights, tags'
    )
  })

  it('caps the list at eight rows', () => {
    const results = Array.from({ length: 12 }, (_, i) => ({
      type: 'web' as const,
      title: `Page ${i}`,
      match: 'Title'
    }))
    const { container } = render(<CommandPaletteView query="page" results={results} />)
    expect(container.querySelectorAll('.wa-pal__row')).toHaveLength(8)
  })
})
