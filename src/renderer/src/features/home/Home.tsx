// Home: the Welcome screen on first run, otherwise the grid of saved workspaces.
import { useEffect, useState, type ReactElement } from 'react'
import { toast } from 'sonner'
import type { CreateWorkspaceInput } from '@shared/api'
import type { WorkspaceSummary } from '@shared/types'
import { Button } from '@renderer/components/wa/Button'
import { Icon } from '@renderer/components/wa/Icon'
import { WorkspaceCard } from '@renderer/components/wa/WorkspaceCard'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { errorMessage } from '@renderer/lib/errors'
import {
  createAndOpenWorkspace,
  openWorkspace,
  openWorkspaceById
} from '@renderer/store/workspaceActions'
import { NewWorkspaceDialog } from './NewWorkspaceDialog'
import { Welcome } from './Welcome'

/** Newest first, as DESIGN.md asks ("Sort by last opened"). */
function sortByUpdated(rows: WorkspaceSummary[]): WorkspaceSummary[] {
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
}

const fail = (what: string) => (err: unknown) => toast(`${what}: ${errorMessage(err)}`)

export function Home(): ReactElement {
  const [rows, setRows] = useState<WorkspaceSummary[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<WorkspaceSummary | null>(null)

  const load = (): Promise<WorkspaceSummary[]> =>
    window.api.workspace.list().then(sortByUpdated, (err) => {
      fail("Couldn't read your workspaces")(err)
      return []
    })

  const refresh = async (): Promise<void> => setRows(await load())

  useEffect(() => {
    let live = true
    void load().then((list) => live && setRows(list))
    return () => {
      live = false
    }
  }, [])

  const create = async (input: CreateWorkspaceInput): Promise<void> => {
    try {
      await createAndOpenWorkspace(input)
    } catch (err) {
      fail("Couldn't create the workspace")(err)
      throw err
    }
  }

  const openSample = (): void => {
    window.api.import.sample().then(openWorkspace).catch(fail("Couldn't open the sample"))
  }

  const importFile = async (): Promise<void> => {
    try {
      const ws = await window.api.import.workspace()
      if (!ws) return
      toast(`Imported ‘${ws.name}’`)
      await refresh()
    } catch (err) {
      toast(errorMessage(err))
    }
  }

  const duplicate = async (row: WorkspaceSummary): Promise<void> => {
    try {
      await window.api.workspace.duplicate(row.id)
      await refresh()
    } catch (err) {
      fail("Couldn't duplicate it")(err)
    }
  }

  const remove = async (row: WorkspaceSummary): Promise<void> => {
    try {
      await window.api.workspace.delete(row.id)
      await refresh()
    } catch (err) {
      fail("Couldn't delete it")(err)
    }
  }

  if (rows === null) return <main data-testid="app-root" className="min-h-full bg-canvas" />

  return (
    <main data-testid="app-root" className="min-h-full bg-canvas text-ink">
      {rows.length === 0 ? (
        <Welcome onCreate={() => setCreating(true)} onOpenSample={openSample} />
      ) : (
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 p-12">
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="wa-display-lg flex-1">Your workspaces</h1>
            <Button icon="file" onClick={() => void importFile()}>
              Import
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              New workspace
            </Button>
          </header>
          <div className="grid grid-cols-[repeat(auto-fill,280px)] gap-6">
            {rows.map((row) => (
              <WorkspaceCard
                key={row.id}
                name={row.name}
                question={row.researchQuestion}
                nodes={row.nodeCount}
                groups={row.groupCount}
                updatedAt={row.updatedAt}
                coverThumb={row.coverThumb}
                onOpen={() => void openWorkspaceById(row.id).catch(fail("Couldn't open it"))}
                menu={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="wa-tb"
                        aria-label={`Options for ${row.name}`}
                      >
                        <Icon name="more" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => void duplicate(row)}>
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toast('Export arrives in a later step.')}>
                        Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="danger" onSelect={() => setConfirmDelete(row)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            ))}
          </div>
        </div>
      )}

      <NewWorkspaceDialog open={creating} onOpenChange={setCreating} onCreate={create} />

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete workspace</DialogTitle>
          <DialogDescription>
            Delete ‘{confirmDelete?.name}’? This can&apos;t be undone.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button
              variant="reject"
              icon="trash"
              onClick={() => {
                const row = confirmDelete
                setConfirmDelete(null)
                if (row) void remove(row)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
