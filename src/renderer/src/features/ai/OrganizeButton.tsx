// Top bar: "Organize" asks the agent for suggestions; "Suggestions (N)" opens the panel.
import type { ReactElement } from 'react'
import { Button } from '@renderer/components/wa/Button'
import { Tip } from '@renderer/components/ui/tooltip'
import { useAppStore } from '@renderer/store/appStore'
import { runOrganize } from './runOrganize'
import { useSuggestionCount } from './useSuggestions'

export function OrganizeButton(): ReactElement {
  const organizing = useAppStore((s) => s.organizing)
  return (
    <Tip label="Suggest groups and links for your pages. You decide what stays." side="bottom">
      <Button
        variant="secondary"
        icon={organizing ? 'spinner' : 'graph'}
        disabled={organizing}
        aria-busy={organizing}
        data-testid="organize-button"
        onClick={() => void runOrganize()}
      >
        {organizing ? 'Organizing…' : 'Organize'}
      </Button>
    </Tip>
  )
}

/** Opens or closes the Suggestions tab of the side panel. */
export function SuggestionsToggle(): ReactElement {
  const open = useAppStore((s) => s.sideTab === 'suggestions')
  const count = useSuggestionCount()
  const label = `Suggestions (${count})`
  return (
    <Tip label={`${open ? 'Hide' : 'Show'} suggestions (${count})`} side="bottom">
      <Button
        variant="ghost"
        icon="focus"
        aria-pressed={open}
        aria-label={label}
        data-testid="suggestions-toggle"
        onClick={() => useAppStore.getState().setSideTab(open ? 'details' : 'suggestions')}
      >
        <span className="wa-topbar__long">Suggestions</span>
        <span>({count})</span>
      </Button>
    </Tip>
  )
}
