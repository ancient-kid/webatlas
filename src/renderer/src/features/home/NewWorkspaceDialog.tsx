import { useState, type FormEvent, type ReactElement } from 'react'
import type { CreateWorkspaceInput } from '@shared/api'
import { Button } from '@renderer/components/wa/Button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle
} from '@renderer/components/ui/dialog'

export interface NewWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves when the workspace exists; a rejection keeps the dialog open. */
  onCreate: (input: CreateWorkspaceInput) => Promise<void>
}

export function NewWorkspaceDialog({
  open,
  onOpenChange,
  onCreate
}: NewWorkspaceDialogProps): ReactElement {
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = (): void => {
    setName('')
    setQuestion('')
    setBusy(false)
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const input: CreateWorkspaceInput = { name: name.trim() }
      if (question.trim()) input.researchQuestion = question.trim()
      await onCreate(input)
      reset()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            One workspace per assignment or topic. The research question sits at the centre of your
            map.
          </DialogDescription>
          <label className="wa-field">
            Name
            <input
              className="wa-input"
              autoFocus
              value={name}
              maxLength={120}
              placeholder="Flood finance"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="wa-field">
            Research question (optional)
            <textarea
              className="wa-input"
              value={question}
              maxLength={500}
              placeholder="What are you trying to answer?"
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
