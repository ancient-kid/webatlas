// shadcn-style tooltip on Radix, restyled with the DESIGN.md tokens (.wa-tip).
// Each tooltip carries its own provider, so components work without app-level setup.
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

export const TOOLTIP_DELAY_MS = 300

export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>): ReactElement {
  return (
    <TooltipPrimitive.Provider delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipPrimitive.Root {...props} />
    </TooltipPrimitive.Provider>
  )
}

export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>): ReactElement {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn('wa-tip', className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

/** Shorthand: wraps one focusable element with a tooltip. */
export function Tip({
  label,
  side = 'top',
  children
}: {
  label: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactElement
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
