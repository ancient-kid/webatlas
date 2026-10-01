import * as MenuPrimitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>): ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn('wa wa-menu', className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { variant?: 'default' | 'danger' }): ReactElement {
  return (
    <MenuPrimitive.Item
      className={cn('wa-menu__item', variant === 'danger' && 'wa-menu__item--danger', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator(
  props: ComponentProps<typeof MenuPrimitive.Separator>
): ReactElement {
  return <MenuPrimitive.Separator className="wa-menu__sep" {...props} />
}
