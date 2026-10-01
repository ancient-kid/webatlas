import { Handle, Position } from '@xyflow/react'
import type { ReactElement } from 'react'

const SIDES = [
  [Position.Top, 'top'],
  [Position.Right, 'right'],
  [Position.Bottom, 'bottom'],
  [Position.Left, 'left']
] as const

/**
 * Four connection handles (DESIGN.md: shown when selected or hovered). All are
 * sources; the canvas uses loose connection mode so any handle can join any other.
 */
export function CardHandles(): ReactElement {
  return (
    <>
      {SIDES.map(([position, id]) => (
        <Handle key={id} id={id} type="source" position={position} className="wa-rf-handle" />
      ))}
    </>
  )
}
