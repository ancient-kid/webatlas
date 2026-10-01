import type { ReactElement } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/wa/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useAppStore } from '@renderer/store/appStore'
import { useBoardStore } from '@renderer/store/boardStore'
import { assembleWorkspace } from '@renderer/store/persistence'
import { toJsonCanvas } from '@shared/export/jsonCanvas'
import { toMarkdown } from '@shared/export/markdown'
import { toWorkspaceFile } from '@shared/export/workspaceFile'

export function ExportMenu(): ReactElement | null {
  const hasWorkspace = useAppStore((s) => s.workspace !== null)
  if (!hasWorkspace) return null

  const handleExport = async (format: 'md' | 'json' | 'canvas'): Promise<void> => {
    try {
      const workspace = assembleWorkspace(useBoardStore, useAppStore)
      if (!workspace) return
      let content: string
      if (format === 'md') {
        content = toMarkdown(workspace)
      } else if (format === 'canvas') {
        content = JSON.stringify(toJsonCanvas(workspace), null, 2)
      } else {
        content = JSON.stringify(toWorkspaceFile(workspace), null, 2)
      }

      const path = await window.api.export.save(format, content, workspace.name)
      if (path) {
        const fileName = path.split(/[\\/]/).pop()
        toast(`Exported to ${fileName}`)
      }
    } catch (err) {
      toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" icon="export" aria-label="Export workspace">
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('md')}>Markdown (.md)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>JSON (.json)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('canvas')}>
          Obsidian Canvas (.canvas)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
