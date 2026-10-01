import type { ReactElement } from 'react'
import { Button } from '@renderer/components/wa/Button'

export interface WelcomeProps {
  onCreate: () => void
  onOpenSample: () => void
}

/** First run: nothing saved yet. */
export function Welcome({ onCreate, onOpenSample }: WelcomeProps): ReactElement {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-12 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="wa-display-xl">WebAtlas</h1>
        <p className="m-0 text-[17px] leading-6 text-ink-muted">Your browsing, drawn as a map.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="primary" icon="plus" onClick={onCreate}>
          Create workspace
        </Button>
        <Button icon="compass" onClick={onOpenSample}>
          Open sample workspace
        </Button>
      </div>
      <p className="wa-caption m-0 text-ink-subtle">Everything stays on your device.</p>
    </div>
  )
}
