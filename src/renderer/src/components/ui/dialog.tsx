import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@renderer/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="wa-overlay" />
      <DialogPrimitive.Content className={cn('wa wa-dialog', className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>): ReactElement {
  return <DialogPrimitive.Title className={cn('wa-dialog__title', className)} {...props} />
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): ReactElement {
  return <DialogPrimitive.Description className={cn('wa-dialog__desc', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('wa-dialog__footer', className)} {...props} />
}
