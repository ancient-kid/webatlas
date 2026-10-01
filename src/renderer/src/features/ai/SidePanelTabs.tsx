// The side panel's tab strip: Details (the selection) and Suggestions (N).
import type { ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'
import { useAppStore, type SideTab } from '@renderer/store/appStore'
import { useSuggestionCount } from './useSuggestions'

export function SidePanelTabs({ active }: { active: SideTab }): ReactElement {
  const count = useSuggestionCount()
  const hasSelection = useAppStore((s) => s.session.selectedIds.length > 0)
  const setTab = useAppStore((s) => s.setSideTab)
  const tab = (id: SideTab, label: string, disabled = false): ReactElement => (
    <button
      type="button"
      role="tab"
      aria-selected={active === id}
      disabled={disabled}
      title={disabled ? 'Select a card to see its details' : undefined}
      className={cn('wa-side-tab', active === id && 'wa-side-tab--active')}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  )
  return (
    <div className="wa-side-tabs" role="tablist" aria-label="Side panel">
      {tab('details', 'Details', active !== 'details' && !hasSelection)}
      {tab('suggestions', `Suggestions (${count})`)}
    </div>
  )
}
