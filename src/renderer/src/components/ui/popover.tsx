import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  sideOffset = 6,
  align = 'center',
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>): ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn('wa wa-pop', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
