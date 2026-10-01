// Browser | canvas split. The divider is dragged with the mouse or moved with the arrow
// keys; the browser width stays between SPLIT_RATIO_MIN and SPLIT_RATIO_MAX percent, so
// neither side can be squeezed away (closing is done with the toggle). When closed, the
// left side keeps its content mounted (the web page stays loaded) at zero width.
import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { clampSplitRatio, SPLIT_RATIO_MAX, SPLIT_RATIO_MIN } from '@shared/session'

/** Arrow keys move the divider by this many percent (Shift: 10). */
export const SPLIT_KEY_STEP = 2

export interface SplitLayoutProps {
  /** Whether the left (browser) side is shown. */
  open: boolean
  /** Left width in percent. */
  ratio: number
  /** Called once when a drag or key press ends, with the clamped ratio. */
  onRatioChange: (ratio: number) => void
  left: ReactNode
  right: ReactNode
}

export function SplitLayout(p: SplitLayoutProps): ReactElement {
  const container = useRef<HTMLDivElement>(null)
  // While dragging, the live ratio is local; the store is updated on release.
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const ratio = dragRatio ?? clampSplitRatio(p.ratio)

  const ratioAt = (clientX: number): number => {
    const rect = container.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return ratio
    return clampSplitRatio(((clientX - rect.left) / rect.width) * 100)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragRatio(ratio)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (dragRatio !== null) setDragRatio(ratioAt(e.clientX))
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>): void => {
    if (dragRatio === null) return
    const final = ratioAt(e.clientX)
    setDragRatio(null)
    p.onRatioChange(final)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = e.shiftKey ? 10 : SPLIT_KEY_STEP
    const next =
      e.key === 'ArrowLeft'
        ? ratio - step
        : e.key === 'ArrowRight'
          ? ratio + step
          : e.key === 'Home'
            ? SPLIT_RATIO_MIN
            : e.key === 'End'
              ? SPLIT_RATIO_MAX
              : null
    if (next === null) return
    e.preventDefault()
    p.onRatioChange(clampSplitRatio(next))
  }

  return (
    <div ref={container} className="wa-split">
      <div
        className="wa-split__left"
        data-testid="browser-panel"
        aria-hidden={!p.open}
        style={p.open ? { width: `${ratio}%` } : { width: 0, visibility: 'hidden' }}
      >
        {p.left}
      </div>
      {p.open ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize browser and canvas"
          aria-valuemin={SPLIT_RATIO_MIN}
          aria-valuemax={SPLIT_RATIO_MAX}
          aria-valuenow={Math.round(ratio)}
          tabIndex={0}
          className="wa-split__divider"
          data-dragging={dragRatio !== null || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        />
      ) : null}
      <div className="wa-split__right" data-testid="canvas-area">
        {p.right}
      </div>
      {/* Keeps the web page from swallowing the pointer while the divider is dragged. */}
      {dragRatio !== null ? <div className="wa-split__shield" aria-hidden="true" /> : null}
    </div>
  )
}
