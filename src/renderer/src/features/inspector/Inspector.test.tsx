// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBoard, makeGroup, makeNode, makeQuestion } from '@shared/testing/factories'
import { installApiStub } from '@renderer/test/apiStub'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { registerCanvas } from '../canvas/canvasControl'
import { Inspector } from './Inspector'

const b = (): ReturnType<typeof useBoardStore.getState>['board'] => useBoardStore.getState().board

function select(...ids: string[]): void {
  act(() => useAppStore.getState().patchSession({ selectedIds: ids }))
}

beforeEach(() => {
  installApiStub()
  useBoardStore.getState().load(
    makeBoard({
      nodes: [
        makeQuestion(),
        makeNode({
          id: 'parent-card',
          title: 'Parent source',
          url: 'https://example.com/parent'
        }),
        makeNode({
          id: 'web-1',
          kind: 'webpage',
          title: 'Flood risks',
          url: 'https://example.com/flood',
          summary: 'A study on rising sea levels and flood defense budgets.',
          capturedFromNodeId: 'parent-card',
          note: 'Initial note',
          tags: ['flood', 'climate'],
          highlights: [
            { id: 'h1', quote: 'Old highlight', createdAt: 1000 },
            { id: 'h2', quote: 'New highlight', createdAt: 2000 }
          ],
          comments: [{ id: 'c1', text: 'Check methodology', createdAt: 3000 }]
        }),
        makeNode({ id: 'web-2', title: 'Coastal adaptation', tags: ['adaptation'] }),
        makeNode({ id: 'web-3', title: 'Green bonds', tags: ['finance'] })
      ],
      groups: [
        makeGroup({
          id: 'g1',
          label: 'Policy analysis',
          category: 'topic',
          color: 'teal',
          note: 'Group notes',
          comments: [{ id: 'gc1', text: 'Important group', createdAt: 4000 }]
        })
      ]
    })
  )
  useAppStore.getState().patchSession({ selectedIds: [] })
})

describe('Inspector', () => {
  it('is hidden when nothing is selected', () => {
    select()
    const { container } = render(<Inspector />)
    expect(container.firstChild).toBeNull()
  })

  it('can be closed via the close button', async () => {
    select('web-1')
    render(<Inspector />)
    expect(screen.getByTestId('inspector-panel')).toBeInTheDocument()

    const closeBtn = screen.getByLabelText('Close details')
    await userEvent.click(closeBtn)
    expect(useAppStore.getState().session.selectedIds).toEqual([])
  })

  it('title edit + blur dispatches one updateNode and one history entry', async () => {
    select('web-1')
    render(<Inspector />)

    const titleInput = screen.getByLabelText('Title')
    expect(titleInput).toHaveValue('Flood risks')

    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Flood risks in Rotterdam')
    // While typing, the store has not been updated yet
    expect(b().nodes['web-1'].title).toBe('Flood risks')
    expect(useBoardStore.getState().past).toHaveLength(0)

    // Blur commits the change
    await userEvent.tab()
    expect(b().nodes['web-1'].title).toBe('Flood risks in Rotterdam')
    expect(useBoardStore.getState().past).toHaveLength(1)
  })

  it('note textarea typing + blur dispatches one history entry', async () => {
    select('web-1')
    render(<Inspector />)

    const noteInput = screen.getByLabelText('Your note')
    expect(noteInput).toHaveValue('Initial note')

    await userEvent.clear(noteInput)
    await userEvent.type(noteInput, 'Key takeaways for Rotterdam defense fund.')
    expect(b().nodes['web-1'].note).toBe('Initial note')
    expect(useBoardStore.getState().past).toHaveLength(0)

    // Blur commits as a single command
    await userEvent.tab()
    expect(b().nodes['web-1'].note).toBe('Key takeaways for Rotterdam defense fund.')
    expect(useBoardStore.getState().past).toHaveLength(1)

    // Undo restores the initial note
    act(() => useBoardStore.getState().undo())
    expect(b().nodes['web-1'].note).toBe('Initial note')
  })

  it('adds and removes a tag', async () => {
    select('web-1')
    render(<Inspector />)

    // Remove existing tag 'climate'
    const removeBtn = screen.getByLabelText('Remove tag climate')
    await userEvent.click(removeBtn)
    expect(b().nodes['web-1'].tags).toEqual(['flood'])

    // Add new tag 'resilience'
    const tagInput = screen.getByPlaceholderText('Add tag...')
    await userEvent.type(tagInput, 'resilience{Enter}')
    expect(b().nodes['web-1'].tags).toContain('resilience')
  })

  it('removes a highlight', async () => {
    select('web-1')
    render(<Inspector />)

    // Highlights should show in newest-first order
    expect(screen.getByText('New highlight')).toBeInTheDocument()
    expect(screen.getByText('Old highlight')).toBeInTheDocument()

    const removeBtns = screen.getAllByLabelText('Remove highlight')
    // Click remove on the first one (newest: h2)
    await userEvent.click(removeBtns[0])
    expect(b().nodes['web-1'].highlights).toHaveLength(1)
    expect(b().nodes['web-1'].highlights[0].id).toBe('h1')
  })

  it('adds a comment with a timestamp and removes a comment', async () => {
    select('web-1')
    render(<Inspector />)

    expect(screen.getByText('Check methodology')).toBeInTheDocument()

    // Add a comment
    const commentInput = screen.getByPlaceholderText('Add comment...')
    await userEvent.type(commentInput, 'Supervisor requested citations{Enter}')
    expect(b().nodes['web-1'].comments).toHaveLength(2)
    expect(b().nodes['web-1'].comments[1].text).toBe('Supervisor requested citations')
    expect(b().nodes['web-1'].comments[1].createdAt).toBeGreaterThan(0)

    // Remove the comment
    const removeBtns = screen.getAllByLabelText('Remove comment')
    await userEvent.click(removeBtns[0])
    expect(b().nodes['web-1'].comments).toHaveLength(1)
  })

  it('the opened-from link calls jumpTo (selects and zooms to parent)', async () => {
    select('web-1')
    const zoomToSpy = vi.fn()
    const revealSpy = vi.fn()
    const selectSpy = vi.fn()

    registerCanvas({
      select: selectSpy,
      reveal: revealSpy,
      zoomTo: zoomToSpy,
      centre: () => ({ x: 0, y: 0 })
    })

    render(<Inspector />)

    const provenanceBtn = screen.getByTitle('Jump to referring card')
    expect(provenanceBtn).toHaveTextContent('Opened from Parent source')

    await userEvent.click(provenanceBtn)

    expect(useAppStore.getState().session.selectedIds).toEqual(['parent-card'])
    expect(selectSpy).toHaveBeenCalledWith(['parent-card'])
    expect(zoomToSpy).toHaveBeenCalledWith(['parent-card'])
  })

  it('inspects and edits a group (label, category, colour, note)', async () => {
    select('g1')
    render(<Inspector />)

    expect(screen.getByTestId('inspector-group-details')).toBeInTheDocument()

    // Edit label
    const labelInput = screen.getByLabelText('Label')
    expect(labelInput).toHaveValue('Policy analysis')
    await userEvent.clear(labelInput)
    await userEvent.type(labelInput, 'Infrastructure finance')
    await userEvent.tab()
    expect(b().groups.g1.label).toBe('Infrastructure finance')

    // Change category
    const categorySelect = screen.getByLabelText('Category')
    await userEvent.selectOptions(categorySelect, 'importance')
    expect(b().groups.g1.category).toBe('importance')

    // Change colour
    const roseSwatch = screen.getByLabelText('Colour rose')
    await userEvent.click(roseSwatch)
    expect(b().groups.g1.color).toBe('rose')

    // Edit group note
    const noteInput = screen.getByLabelText('Group note')
    expect(noteInput).toHaveValue('Group notes')
    await userEvent.clear(noteInput)
    await userEvent.type(noteInput, 'Consolidated infrastructure notes')
    await userEvent.tab()
    expect(b().groups.g1.note).toBe('Consolidated infrastructure notes')
  })

  it('supports multi-select with bulk tag and colour', async () => {
    select('web-1', 'web-2', 'web-3')
    render(<Inspector />)

    expect(screen.getByTestId('inspector-multi-details')).toBeInTheDocument()
    expect(screen.getByText('3 selected')).toBeInTheDocument()

    // Bulk tag
    const tagInput = screen.getByPlaceholderText('Tag...')
    await userEvent.type(tagInput, 'prioritized{Enter}')

    expect(b().nodes['web-1'].tags).toContain('prioritized')
    expect(b().nodes['web-2'].tags).toContain('prioritized')
    expect(b().nodes['web-3'].tags).toContain('prioritized')

    // Bulk colour
    const blueSwatch = screen.getByLabelText('Colour blue')
    await userEvent.click(blueSwatch)

    expect(b().nodes['web-1'].color).toBe('blue')
    expect(b().nodes['web-2'].color).toBe('blue')
    expect(b().nodes['web-3'].color).toBe('blue')
  })
})
