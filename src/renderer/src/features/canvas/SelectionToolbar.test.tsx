// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeBoard, makeEdge, makeGroup, makeNode, makeQuestion } from '@shared/testing/factories'
import { installApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { useCanvasUi } from './canvasUi'
import { EdgeEditor } from './EdgeEditor'
import { SelectionControls } from './SelectionToolbar'

const b = (): ReturnType<typeof useBoardStore.getState>['board'] => useBoardStore.getState().board

function select(...ids: string[]): void {
  act(() => useAppStore.getState().patchSession({ selectedIds: ids }))
}

beforeEach(() => {
  installApiStub()
  useBoardStore.getState().load(
    makeBoard({
      nodes: [
        makeQuestion({ position: { x: 0, y: 0 } }),
        makeNode({ id: 'web', position: { x: 400, y: 0 }, tags: ['policy'] }),
        makeNode({ id: 'note1', kind: 'note', title: 'A', position: { x: 800, y: 0 } }),
        makeNode({ id: 'note2', kind: 'note', title: 'B', position: { x: 1200, y: 0 } })
      ],
      groups: [makeGroup({ id: 'g1', position: { x: 0, y: 2000 } })],
      edges: [makeEdge({ id: 'e1', source: 'web', target: 'question', relation: 'related' })]
    })
  )
  useAppStore.getState().patchSession({ selectedIds: [] })
  useCanvasUi.setState({ editingId: null, edgeMenu: null })
})

describe('SelectionControls', () => {
  it('renders nothing without a selection', () => {
    const { container } = render(<SelectionControls />)
    expect(container).toBeEmptyDOMElement()
  })

  it('a colour click colours every selected card and group as one undo step', async () => {
    select('web', 'note1', 'g1')
    render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Colour rose' }))
    expect(b().nodes.web.color).toBe('rose')
    expect(b().nodes.note1.color).toBe('rose')
    expect(b().groups.g1.color).toBe('rose')
    expect(useBoardStore.getState().past).toHaveLength(1)
    // Now all share rose, so the swatch shows as active; clicking it again clears cards.
    expect(screen.getByRole('button', { name: 'Colour rose' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('Tag opens a field; Enter adds the tag; existing tags are suggested', async () => {
    select('note1', 'note2')
    render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Tag' }))
    const field = await screen.findByRole('textbox', { name: 'Tag' })
    expect(screen.getByLabelText('Existing tags')).toHaveTextContent('policy')
    await userEvent.type(field, 'Must Cite{Enter}')
    expect(b().nodes.note1.tags).toEqual(['must cite'])
    expect(b().nodes.note2.tags).toEqual(['must cite'])
  })

  it('a suggested tag can be clicked', async () => {
    select('note1')
    render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Tag' }))
    const existing = await screen.findByLabelText('Existing tags')
    await userEvent.click(within(existing).getByText('policy'))
    expect(b().nodes.note1.tags).toEqual(['policy'])
  })

  it('Group appears only for two or more cards and wraps them', async () => {
    select('note1')
    const { unmount } = render(<SelectionControls />)
    expect(screen.queryByRole('button', { name: 'Group' })).toBeNull()
    unmount()

    select('note1', 'note2')
    render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Group' }))
    const groups = Object.values(b().groups).filter((g) => g.id !== 'g1')
    expect(groups).toHaveLength(1)
    expect(b().nodes.note1.parentGroupId).toBe(groups[0].id)
    expect(b().nodes.note2.parentGroupId).toBe(groups[0].id)
    expect(useCanvasUi.getState().editingId).toBe(groups[0].id) // label ready to rename
  })

  it('Open in browser pane shows for a single page card, not for notes or several cards', () => {
    select('note1')
    const { unmount } = render(<SelectionControls />)
    expect(screen.queryByRole('button', { name: 'Open in browser pane' })).toBeNull()
    unmount()
    select('web', 'note1')
    const second = render(<SelectionControls />)
    expect(screen.queryByRole('button', { name: 'Open in browser pane' })).toBeNull()
    second.unmount()
    select('web')
    render(<SelectionControls />)
    expect(screen.getByRole('button', { name: 'Open in browser pane' })).toBeInTheDocument()
  })

  it('Note on a page card edits its note; on a note card it starts editing the text', async () => {
    select('web')
    const { unmount } = render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Note' }))
    const field = await screen.findByRole('textbox', { name: 'Your note' })
    await userEvent.type(field, 'Cite in the intro{Control>}{Enter}{/Control}')
    expect(b().nodes.web.note).toBe('Cite in the intro')
    unmount()

    select('note1')
    render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Note' }))
    expect(useCanvasUi.getState().editingId).toBe('note1')
  })

  it('Delete removes the selection but never the question card', async () => {
    select('web', 'question')
    render(<SelectionControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(b().nodes.web).toBeUndefined()
    expect(b().nodes.question).toBeDefined()
  })
})

describe('EdgeEditor', () => {
  const open = (): void =>
    act(() => useCanvasUi.getState().openEdgeMenu({ id: 'e1', x: 100, y: 100 }))

  it('choosing "supports" changes the relation', async () => {
    render(<EdgeEditor />)
    open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'supports' }))
    expect(b().edges.e1.relation).toBe('supports')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('Custom… asks for a label and sets it', async () => {
    render(<EdgeEditor />)
    open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom…' }))
    const field = await screen.findByRole('textbox', { name: 'Label' })
    await userEvent.type(field, 'cites{Enter}')
    expect(b().edges.e1).toMatchObject({ relation: 'custom', label: 'cites' })
  })

  it('Delete link removes the link', async () => {
    render(<EdgeEditor />)
    open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete link' }))
    expect(b().edges.e1).toBeUndefined()
  })
})
