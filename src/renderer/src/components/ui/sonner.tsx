// Toasts (sonner) in the DESIGN.md voice: surface card, ink text, overlay shadow.
import type { CSSProperties, ReactElement } from 'react'
import { Toaster as Sonner } from 'sonner'

export function Toaster(): ReactElement {
  return (
    <Sonner
      position="bottom-center"
      closeButton={false}
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--ink)',
          '--normal-border': 'var(--line)',
          '--border-radius': 'var(--radius-md)',
          fontFamily: 'var(--font-sans)'
        } as CSSProperties
      }
      toastOptions={{
        style: { boxShadow: 'var(--shadow-overlay)', font: '400 14px/21px var(--font-sans)' }
      }}
    />
  )
}
