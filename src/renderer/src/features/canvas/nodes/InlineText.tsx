import { useEffect, useRef, type ReactElement } from 'react'

export interface InlineTextProps {
  initial: string
  onCommit: (text: string) => void
  onDone: () => void
  className?: string
  multiline?: boolean
  label: string
  placeholder?: string
}

/**
 * In-place editor for card text. Blur or Ctrl+Enter (Enter for one-line fields) saves;
 * Escape cancels. `nodrag nowheel` keeps typing and scrolling from moving the canvas.
 */
export function InlineText(p: InlineTextProps): ReactElement {
  const cancelled = useRef(false)
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  // A new canvas node stays invisible until React Flow measures it, so autofocus can
  // miss; focus again on the next frames.
  useEffect(() => {
    let tries = 0
    let frame = 0
    const focus = (): void => {
      const el = field.current
      if (!el || document.activeElement === el) return
      el.focus()
      el.select()
      if (document.activeElement !== el && tries++ < 10) frame = requestAnimationFrame(focus)
    }
    frame = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(frame)
  }, [])
  const finish = (value: string): void => {
    if (!cancelled.current && value !== p.initial) p.onCommit(value)
    p.onDone()
  }
  const common = {
    className: `nodrag nowheel wa-inline ${p.className ?? ''}`,
    defaultValue: p.initial,
    ref: field,
    'aria-label': p.label,
    placeholder: p.placeholder,
    onBlur: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) =>
      finish(e.currentTarget.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        cancelled.current = true
        e.currentTarget.blur()
      } else if (e.key === 'Enter' && (!p.multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.currentTarget.blur()
      }
    }
  }
  return p.multiline ? <textarea rows={3} {...common} /> : <input {...common} />
}
