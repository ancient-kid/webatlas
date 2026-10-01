// The link menu: double-click a link (or its label) to change what it means, give it a
// custom verb, or delete it. Each choice is one undo step.
import { useState, type ReactElement } from 'react'
import { Icon } from '@renderer/components/wa/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { disconnectEdges, setEdgeRelation } from '@renderer/store/actions'
import { useBoardStore } from '@renderer/store/boardStore'
import { useCanvasUi, type EdgeMenu } from './canvasUi'
import { EDITABLE_RELATIONS, relationLabel } from './relations'

function CustomLabel({ menu, onDone }: { menu: EdgeMenu; onDone: () => void }): ReactElement {
  const current = useBoardStore((s) => s.board.edges[menu.id])
  const [value, setValue] = useState(current?.relation === 'custom' ? (current.label ?? '') : '')
  const save = (): void => {
    if (value.trim()) setEdgeRelation(menu.id, 'custom', value)
    onDone()
  }
  return (
    <form
      className="wa wa-pop fixed"
      style={{ left: menu.x, top: menu.y }}
      role="dialog"
      aria-label="Custom link label"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="wa-field">
        Label
        <input
          className="wa-input"
          autoFocus
          value={value}
          placeholder="cites"
          onChange={(e) => setValue(e.target.value)}
          onBlur={onDone}
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
        />
      </label>
    </form>
  )
}

export function EdgeEditor(): ReactElement | null {
  const menu = useCanvasUi((s) => s.edgeMenu)
  const edge = useBoardStore((s) => (menu ? s.board.edges[menu.id] : undefined))
  const [custom, setCustom] = useState<EdgeMenu | null>(null)
  const close = (): void => useCanvasUi.getState().openEdgeMenu(null)

  if (custom) return <CustomLabel menu={custom} onDone={() => setCustom(null)} />
  if (!menu || !edge) return null

  return (
    <DropdownMenu open onOpenChange={(open) => !open && close()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          style={{ position: 'fixed', left: menu.x, top: menu.y, width: 1, height: 1 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        aria-label="Link"
        // Keep focus where the next step puts it (e.g. the custom label field).
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {EDITABLE_RELATIONS.map((relation) => (
          <DropdownMenuItem key={relation} onSelect={() => setEdgeRelation(edge.id, relation)}>
            <span className="inline-flex w-4">
              {edge.relation === relation ? <Icon name="check" size={14} /> : null}
            </span>
            {relationLabel({ relation })}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => setCustom(menu)}>
          <span className="inline-flex w-4">
            {edge.relation === 'custom' ? <Icon name="check" size={14} /> : null}
          </span>
          Custom…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={() => disconnectEdges([edge.id])}>
          <Icon name="trash" size={14} />
          Delete link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
