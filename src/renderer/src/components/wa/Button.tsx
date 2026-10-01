import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from 'react'
import { cn } from '@renderer/lib/utils'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'secondary' | 'primary' | 'ghost' | 'accept' | 'reject'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  icon?: IconName
  /** Keyboard shortcut shown in a mono chip, e.g. "Alt+A". */
  kbd?: string
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

/** DESIGN.md Button: 32px (26px small). One `primary` per surface. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  kbd,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={cn('wa wa-btn', `wa-btn--${variant}`, size === 'sm' && 'wa-btn--sm', className)}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
      {kbd ? <span className="wa-kbd">{kbd}</span> : null}
    </button>
  )
}
