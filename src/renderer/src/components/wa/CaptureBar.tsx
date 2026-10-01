import { useEffect, useRef, useState, type ReactElement, type Ref } from 'react'
import type { CaptureMode } from '@shared/types'
import { Tip } from '../ui/tooltip'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'

export interface CaptureBarProps {
  url: string
  mode: CaptureMode
  onModeChange?: (mode: CaptureMode) => void
  onAdd?: () => void
  /** The student pressed Enter in the address field (raw text; the consumer resolves it). */
  onNavigate?: (input: string) => void
  onBack?: () => void
  onForward?: () => void
  onReload?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  addDisabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  /** Shows a "Hide browser" button at the start of the bar. */
  onCollapse?: () => void
}

function NavButton(p: {
  icon: IconName
  label: string
  onClick?: () => void
  disabled?: boolean
}): ReactElement {
  return (
    <Tip label={p.label} side="bottom">
      <button
        type="button"
        className="wa-tb"
        aria-label={p.label}
        onClick={p.onClick}
        disabled={p.disabled}
      >
        <Icon name={p.icon} size={16} />
      </button>
    </Tip>
  )
}

/** DESIGN.md CaptureBar: navigation, address, Manual/Auto capture and "Add to canvas". */
export function CaptureBar({ inputRef, ...p }: CaptureBarProps): ReactElement {
  const auto = p.mode === 'auto'
  const [draft, setDraft] = useState(p.url)
  const editing = useRef(false)

  // Follow the page's URL unless the student is typing.
  useEffect(() => {
    if (!editing.current) setDraft(p.url)
  }, [p.url])

  return (
    <div className="wa wa-cap">
      <div className="wa-cap__nav">
        {p.onCollapse ? (
          <NavButton icon="panel-close" label="Hide browser (Ctrl+B)" onClick={p.onCollapse} />
        ) : null}
        <NavButton icon="back" label="Back" onClick={p.onBack} disabled={!p.canGoBack} />
        <NavButton
          icon="forward"
          label="Forward"
          onClick={p.onForward}
          disabled={!p.canGoForward}
        />
        <NavButton icon="reload" label="Reload" onClick={p.onReload} />
      </div>
      <input
        ref={inputRef}
        className="wa-cap__url"
        aria-label="Address"
        placeholder="Search or type an address"
        spellCheck={false}
        value={draft}
        onFocus={(e) => {
          editing.current = true
          e.currentTarget.select()
        }}
        onBlur={() => {
          editing.current = false
          setDraft(p.url)
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            p.onNavigate?.(draft.trim())
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.currentTarget.blur()
          }
        }}
      />
      <div className="wa-seg" role="group" aria-label="Capture mode">
        <button
          type="button"
          aria-pressed={!auto}
          onClick={() => auto && p.onModeChange?.('manual')}
        >
          Manual
        </button>
        <button type="button" aria-pressed={auto} onClick={() => !auto && p.onModeChange?.('auto')}>
          Auto
        </button>
      </div>
      <Button variant="primary" icon="plus" kbd="Alt+A" onClick={p.onAdd} disabled={p.addDisabled}>
        Add to canvas
      </Button>
    </div>
  )
}
