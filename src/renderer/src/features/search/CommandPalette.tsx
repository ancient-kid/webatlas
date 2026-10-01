import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { useState, type ReactElement } from 'react'
import { Icon, type IconName } from '@renderer/components/wa/Icon'
import type { PaletteResultType } from '@renderer/components/wa/CommandPaletteView'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { canvas, jumpTo } from '../canvas/canvasControl'
import { searchBoard, type SearchResult } from './searchIndex'

const ICON: Record<PaletteResultType, IconName> = {
  web: 'globe',
  video: 'play',
  pdf: 'file',
  note: 'note',
  tag: 'tag',
  group: 'focus'
}

const PALETTE_FOOTER = [
  '↑↓ to move',
  'Enter to jump to node',
  'Searches titles, URLs, notes, highlights, tags'
]

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps): ReactElement {
  const [prevOpen, setPrevOpen] = useState(open)
  const [query, setQuery] = useState('')
  const board = useBoardStore((s) => s.board)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setQuery('')
  }

  const results = query.trim() ? searchBoard(board, query) : []

  const handleSelect = (r: SearchResult): void => {
    onOpenChange(false)
    if (r.type === 'tag') {
      const ids = r.ids ?? []
      if (useAppStore.getState().session.viewMode === 'list') {
        useAppStore.getState().patchSession({ viewMode: 'graph', selectedIds: ids })
        setTimeout(() => {
          canvas().select(ids)
          canvas().zoomTo(ids)
        }, 50)
      } else {
        useAppStore.getState().patchSession({ selectedIds: ids })
        canvas().select(ids)
        canvas().zoomTo(ids)
      }
    } else {
      jumpTo(r.id)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="wa-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/4 -translate-x-1/2 z-50 p-0 outline-none border-0 bg-transparent"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search workspace</DialogPrimitive.Title>
          <Command shouldFilter={false} className="wa wa-pal" label="Search workspace">
            <div className="wa-pal__in">
              <Icon name="search" size={18} />
              <Command.Input
                className="flex-1 bg-transparent border-none outline-none font-sans text-[15px] leading-[20px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
                placeholder="Search workspace..."
                value={query}
                onValueChange={setQuery}
                autoFocus
              />
              <span className="wa-kbd">Esc</span>
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto">
              {query.trim() && results.length === 0 && (
                <Command.Empty className="py-6 text-center text-sm text-[var(--ink-muted)]">
                  No matches
                </Command.Empty>
              )}
              {results.map((r) => (
                <Command.Item
                  key={r.id}
                  value={r.id}
                  onSelect={() => handleSelect(r)}
                  className="wa-pal__row cursor-pointer select-none"
                >
                  <Icon name={ICON[r.type]} size={16} />
                  <div className="wa-pal__main">
                    <div className="wa-pal__t">{r.title}</div>
                    <div className="wa-pal__m">{r.match}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.List>
            <div className="wa-pal__foot">
              {PALETTE_FOOTER.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
