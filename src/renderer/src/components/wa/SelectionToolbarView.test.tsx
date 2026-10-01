// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectionToolbarView } from './SelectionToolbarView'

describe('SelectionToolbarView', () => {
  it('has 6 colour swatches with aria-pressed on the active one', () => {
    render(<SelectionToolbarView color="teal" />)
    const swatches = screen.getAllByRole('button', { name: /^Colour / })
    expect(swatches.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Colour rose',
      'Colour amber',
      'Colour moss',
      'Colour teal',
      'Colour blue',
      'Colour plum'
    ])
    expect(swatches.filter((s) => s.getAttribute('aria-pressed') === 'true')).toEqual([
      screen.getByRole('button', { name: 'Colour teal' })
    ])
  })

  it('every button has an accessible name, in the DESIGN.md order', () => {
    render(<SelectionToolbarView onGroup={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names.every(Boolean)).toBe(true)
    expect(names.slice(6)).toEqual([
      'Tag',
      'Note',
      'Open in browser pane',
      'Zoom to selection',
      'Group',
      'Delete'
    ])
  })

  it('clicks call the handlers; the active colour clicked again clears it', async () => {
    const h = {
      onColor: vi.fn(),
      onTag: vi.fn(),
      onNote: vi.fn(),
      onOpen: vi.fn(),
      onZoom: vi.fn(),
      onGroup: vi.fn(),
      onDelete: vi.fn()
    }
    render(<SelectionToolbarView color="teal" {...h} />)
    const click = (name: string): Promise<void> =>
      userEvent.click(screen.getByRole('button', { name }))
    await click('Colour rose')
    await click('Colour teal')
    expect(h.onColor.mock.calls).toEqual([['rose'], [null]])
    await click('Tag')
    await click('Note')
    await click('Open in browser pane')
    await click('Zoom to selection')
    await click('Group')
    await click('Delete')
    for (const fn of [h.onTag, h.onNote, h.onOpen, h.onZoom, h.onGroup, h.onDelete]) {
      expect(fn).toHaveBeenCalledTimes(1)
    }
  })

  it('hides Open, Note and Group when not applicable', () => {
    render(<SelectionToolbarView showOpen={false} showNote={false} />)
    expect(screen.queryByRole('button', { name: 'Open in browser pane' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Group' })).toBeNull()
  })

  it('shows a tooltip on hover', async () => {
    render(<SelectionToolbarView />)
    await userEvent.hover(screen.getByRole('button', { name: 'Zoom to selection' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Zoom to selection')
  })
})
