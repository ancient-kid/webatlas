// The Suggestions tab: every pending AI suggestion with its reason and match, to accept
// or reject one by one or all at once. Pointing at a suggestion highlights it on the canvas.
import type { ReactElement } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/wa/Button'
import { GhostSuggestion } from '@renderer/components/wa/GhostSuggestion'
import { Icon } from '@renderer/components/wa/Icon'
import { acceptAllGhosts, rejectAllGhosts } from '@renderer/store/actions'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { canvas } from '../canvas/canvasControl'
import { SidePanelTabs } from './SidePanelTabs'
import { acceptSuggestion, rejectSuggestion } from './suggestionActions'
import { useSuggestions } from './useSuggestions'

export const EMPTY_SUGGESTIONS = 'No suggestions yet. Capture a few pages, then press Organize.'

export function SuggestionsPanel(): ReactElement {
  const ghosts = useSuggestions()
  const hovered = useAppStore((s) => s.hoveredGhostId)
  const organizing = useAppStore((s) => s.organizing)
  const setHovered = useAppStore((s) => s.setHoveredGhost)

  const acceptAll = (): void => {
    const ids = ghosts.map((g) => g.id)
    const n = acceptAllGhosts()
    setHovered(null)
    if (n) {
      toast(`Accepted ${n} suggestion${n === 1 ? '' : 's'}. Undo removes them one at a time.`)
      const all = Object.keys(useBoardStore.getState().board.nodes)
      setTimeout(() => canvas().zoomTo(all), 60)
    }
    if (n < ids.length) toast('Some suggestions no longer fit the board and were removed.')
  }

  return (
    <aside
      className="wa-inspector wa-side flex h-full w-[320px] shrink-0 flex-col border-l border-line bg-surface overflow-hidden"
      data-testid="suggestions-panel"
      aria-label="Suggestions"
    >
      <div className="wa-inspector__header flex h-11 items-center justify-between border-b border-line px-2">
        <SidePanelTabs active="suggestions" />
        <button
          type="button"
          className="wa-tb"
          aria-label="Close suggestions"
          onClick={() => useAppStore.getState().setSideTab('details')}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {ghosts.length ? (
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <Button variant="accept" size="sm" icon="check" onClick={acceptAll}>
            Accept all
          </Button>
          <Button
            variant="reject"
            size="sm"
            icon="x"
            onClick={() => {
              setHovered(null)
              rejectAllGhosts()
            }}
          >
            Reject all
          </Button>
        </div>
      ) : null}

      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
        data-testid="suggestions-list"
      >
        {ghosts.length ? (
          ghosts.map((g) => (
            <GhostSuggestion
              key={g.id}
              kind={g.kind === 'group' ? 'cluster' : g.kind}
              title={g.title}
              reason={g.rationale}
              confidence={g.confidence}
              hovered={hovered === g.id}
              onHoverChange={(on) => setHovered(on ? g.id : null)}
              onAccept={() => acceptSuggestion(g.id)}
              onReject={() => rejectSuggestion(g.id)}
            />
          ))
        ) : (
          <p className="wa-side-empty" data-testid="suggestions-empty">
            {organizing ? 'Organizing your pages…' : EMPTY_SUGGESTIONS}
          </p>
        )}
      </div>
    </aside>
  )
}
