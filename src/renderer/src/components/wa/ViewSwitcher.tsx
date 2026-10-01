import type { ReactElement } from 'react'
import type { ViewMode } from '@shared/types'
import { Icon, type IconName } from './Icon'

const VIEWS: Record<ViewMode, { icon: IconName; label: string }> = {
  graph: { icon: 'graph', label: 'Graph' },
  focus: { icon: 'focus', label: 'Focus' },
  list: { icon: 'list', label: 'List' }
}

export interface ViewSwitcherProps {
  value: ViewMode
  onChange?: (view: ViewMode) => void
  /** Which views to offer, in order (default all three). */
  views?: ViewMode[]
}

/** DESIGN.md ViewSwitcher: a pill segmented control; icons always sit beside their word. */
export function ViewSwitcher({
  value,
  onChange,
  views = ['graph', 'focus', 'list']
}: ViewSwitcherProps): ReactElement {
  return (
    <div className="wa wa-seg" role="group" aria-label="View mode">
      {views.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => value !== v && onChange?.(v)}
        >
          <Icon name={VIEWS[v].icon} size={14} />
          {VIEWS[v].label}
        </button>
      ))}
    </div>
  )
}
