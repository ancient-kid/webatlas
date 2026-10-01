// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NodeCardView, type NodeCardViewProps } from './NodeCardView'

const base: NodeCardViewProps = {
  kind: 'webpage',
  title: 'Sea-level rise and urban finance',
  url: 'https://nature.com/articles/s41558'
}
const card = (p: Partial<NodeCardViewProps> = {}): HTMLElement =>
  render(<NodeCardView {...base} {...p} />).container.querySelector('article')!

describe('NodeCardView', () => {
  it.each([
    ['webpage', 'Web page'],
    ['video', 'Video'],
    ['pdf', 'PDF']
  ] as const)('a %s card has the "%s" badge', (kind, word) => {
    card({ kind })
    expect(screen.getByText(word)).toHaveClass('wa-badge')
  })

  it('shows the title and the URL without its scheme', () => {
    card()
    expect(screen.getByRole('heading', { name: base.title })).toBeInTheDocument()
    expect(screen.getByText('nature.com/articles/s41558')).toBeInTheDocument()
  })

  it('selected → selected class and 4 handles', () => {
    const el = card({ selected: true })
    expect(el).toHaveClass('wa-card--selected')
    expect(el.querySelectorAll('.wa-handle')).toHaveLength(4)
    expect(
      card({ selected: true, showHandles: false }).querySelectorAll('.wa-handle')
    ).toHaveLength(0)
  })

  it('video → play overlay; web page → none', () => {
    expect(card({ kind: 'video' }).querySelector('.wa-card__play')).not.toBeNull()
    expect(card().querySelector('.wa-card__play')).toBeNull()
  })

  it('pdf with pages → "N pages"', () => {
    card({ kind: 'pdf', pages: 112 })
    expect(screen.getByText('112 pages')).toBeInTheDocument()
  })

  it('5 tags → 3 chips plus "+2"', () => {
    const el = card({ tags: [{ label: 'must-cite', color: 'rose' }, 'a', 'b', 'c', 'd'] })
    const chips = [...el.querySelectorAll('.wa-tag')].map((c) => c.textContent)
    expect(chips).toEqual(['must-cite', 'a', 'b', '+2'])
  })

  it('only the newest highlight is shown', () => {
    card({
      highlights: [
        { quote: 'Newest', createdAt: 30 },
        { quote: 'Oldest', createdAt: 10 },
        { quote: 'Middle', createdAt: 20 }
      ]
    })
    expect(screen.getByText('Newest')).toHaveClass('wa-quote')
    expect(screen.queryByText('Oldest')).toBeNull()
    expect(screen.queryByText('Middle')).toBeNull()
  })

  it('no thumbnail → skeleton; a broken thumbnail falls back to the skeleton', () => {
    expect(card().querySelector('.wa-skel')).not.toBeNull()
    const el = card({ thumbnail: 'wa-thumb://ws/x.png' })
    const img = el.querySelector('.wa-card__thumb img')!
    expect(el.querySelector('.wa-skel')).toBeNull()
    fireEvent.error(img)
    expect(el.querySelector('.wa-skel')).not.toBeNull()
  })

  it('a favicon error → letter fallback', () => {
    const el = card({ faviconUrl: 'https://nature.com/favicon.ico' })
    const fav = el.querySelector('.wa-fav')!
    fireEvent.error(fav.querySelector('img')!)
    expect(fav.querySelector('img')).toBeNull()
    expect(fav).toHaveTextContent('N')
  })

  it('a card with a note shows the note indicator', () => {
    card({ hasNote: true })
    expect(screen.getByRole('img', { name: 'Has a note' })).toBeInTheDocument()
    expect(screen.queryAllByRole('img', { name: 'Has a note' })).toHaveLength(1)
  })

  it('colour set → the border uses the category variable', () => {
    expect(card({ color: 'rose' }).style.border).toBe('2px solid var(--cat-rose)')
    expect(card().style.border).toBe('')
  })

  it('shows the summary and the provenance line', () => {
    card({ summary: 'One-line summary.', openedFrom: 'Google Scholar' })
    expect(screen.getByText('One-line summary.')).toBeInTheDocument()
    expect(screen.getByText('opened from Google Scholar')).toBeInTheDocument()
  })
})
