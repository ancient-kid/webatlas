// Canvas keyboard shortcuts. Ignored while typing (inputs, textareas, editable text)
// so Ctrl+Z there undoes text, not the board.
import { GRID } from '@shared/export/geometry'

export type CanvasKeyAction =
  | { type: 'delete' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'selectAll' }
  | { type: 'clearSelection' }
  | { type: 'nudge'; dx: number; dy: number }

type KeyInput = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'target'
>

/** True when the key press belongs to a text field rather than the canvas. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false
  const el = target as HTMLElement
  if (el.isContentEditable) return true
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-GRID, 0],
  ArrowRight: [GRID, 0],
  ArrowUp: [0, -GRID],
  ArrowDown: [0, GRID]
}

export function keyToAction(e: KeyInput): CanvasKeyAction | null {
  if (isTypingTarget(e.target) || e.altKey) return null
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (mod) {
    if (key === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' }
    if (key === 'y' && !e.shiftKey) return { type: 'redo' }
    if (key === 'a' && !e.shiftKey) return { type: 'selectAll' }
    return null
  }
  if (key === 'Delete' || key === 'Backspace') return { type: 'delete' }
  if (key === 'Escape') return { type: 'clearSelection' }
  const arrow = ARROWS[key]
  if (arrow && !e.shiftKey) return { type: 'nudge', dx: arrow[0], dy: arrow[1] }
  return null
}
