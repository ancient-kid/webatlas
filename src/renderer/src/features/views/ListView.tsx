import { useState, type ReactElement } from 'react'
import { hostOf } from '@shared/kind'
import type { CanvasNode, Group, NodeKind } from '@shared/types'
import { Icon, type IconName } from '@renderer/components/wa/Icon'
import { TagChip } from '@renderer/components/wa/TagChip'
import { formatAgo } from '@renderer/lib/time'
import { useBoardStore } from '@renderer/store/boardStore'
import { catVars } from '@renderer/components/wa/cat'
import { jumpTo } from '../canvas/canvasControl'

type GroupByMode = 'group' | 'tag'

const KIND_ICON: Record<NodeKind, IconName> = {
  webpage: 'globe',
  video: 'play',
  pdf: 'file',
  note: 'note',
  question: 'note'
}

const KIND_LABEL: Record<NodeKind, string> = {
  webpage: 'Web',
  video: 'Video',
  pdf: 'PDF',
  note: 'Note',
  question: 'Question'
}

interface TableProps {
  nodes: CanvasNode[]
  onRowClick: (id: string) => void
}

function SectionTable({ nodes, onRowClick }: TableProps): ReactElement | null {
  if (nodes.length === 0) return null

  return (
    <table className="w-full border-collapse text-left mb-6">
      <thead>
        <tr className="border-b border-[var(--line)] text-[12px] font-medium text-[var(--ink-subtle)]">
          <th className="py-2 px-3 w-[100px]">Type</th>
          <th className="py-2 px-3">Title</th>
          <th className="py-2 px-3 w-[220px]">Tags</th>
          <th className="py-2 px-3 w-[100px]">Highlights</th>
          <th className="py-2 px-3 w-[120px]">Captured</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => {
          const host = node.url ? hostOf(node.url) : null
          const tags = node.tags ?? []
          const visibleTags = tags.slice(0, 3)
          const remaining = tags.length - 3

          return (
            <tr
              key={node.id}
              onClick={() => onRowClick(node.id)}
              className="border-b border-[var(--line)] text-sm cursor-pointer transition-colors hover:bg-[var(--surface-sunken)] group"
              data-testid={`list-row-${node.id}`}
            >
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                  <Icon name={KIND_ICON[node.kind]} size={14} />
                  <span>{KIND_LABEL[node.kind]}</span>
                </span>
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-[var(--ink)]">{node.title}</span>
                  {host && (
                    <span className="font-mono text-xs text-[var(--ink-muted)] truncate max-w-[200px]">
                      {host}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1 flex-wrap">
                  {visibleTags.map((t) => (
                    <TagChip key={t} label={t} />
                  ))}
                  {remaining > 0 && (
                    <span className="text-xs text-[var(--ink-subtle)]">+{remaining}</span>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3 text-[var(--ink-muted)] text-xs">
                {node.highlights?.length ?? 0}
              </td>
              <td className="py-2.5 px-3 text-[var(--ink-subtle)] text-xs">
                {formatAgo(node.capturedAt)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ListView(): ReactElement {
  const [groupBy, setGroupBy] = useState<GroupByMode>('group')
  const board = useBoardStore((s) => s.board)

  // Filter out ghosts
  const allNodes = Object.values(board.nodes).filter(
    (n) => !(n as unknown as { ghost?: boolean }).ghost && n.kind !== 'question'
  )
  const allGroups = Object.values(board.groups).filter(
    (g) => !(g as unknown as { ghost?: boolean }).ghost
  )

  const handleRowClick = (id: string): void => {
    jumpTo(id)
  }

  return (
    <div
      className="h-full w-full overflow-y-auto bg-[var(--canvas)] p-6 select-none"
      data-testid="list-view"
    >
      {/* View Toolbar: Group By */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            Group by
          </span>
          <div className="wa wa-seg" role="group" aria-label="Group by mode">
            <button
              type="button"
              aria-pressed={groupBy === 'group'}
              onClick={() => setGroupBy('group')}
            >
              Group
            </button>
            <button
              type="button"
              aria-pressed={groupBy === 'tag'}
              onClick={() => setGroupBy('tag')}
            >
              Tag
            </button>
          </div>
        </div>
        <div className="text-xs text-[var(--ink-subtle)]">
          {allNodes.length} {allNodes.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Group By: Group */}
      {groupBy === 'group' && (
        <div>
          {/* Defined Groups in order */}
          {allGroups.map((group: Group) => {
            const memberNodes = allNodes.filter((n) => n.parentGroupId === group.id)
            if (memberNodes.length === 0) return null

            return (
              <section key={group.id} className="mb-6">
                <header className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: catVars(group.color)['--gc' as keyof ReturnType<typeof catVars>]
                    }}
                  />
                  <h2 className="wa-overline m-0 text-[var(--ink)] font-semibold">{group.label}</h2>
                  <span className="text-xs text-[var(--ink-subtle)] font-normal">
                    ({memberNodes.length})
                  </span>
                </header>
                <SectionTable nodes={memberNodes} onRowClick={handleRowClick} />
              </section>
            )
          })}

          {/* Not in a group (non-notes) */}
          {(() => {
            const ungrouped = allNodes.filter((n) => !n.parentGroupId && n.kind !== 'note')
            if (ungrouped.length === 0) return null
            return (
              <section className="mb-6">
                <header className="flex items-center gap-2 mb-2">
                  <h2 className="wa-overline m-0 text-[var(--ink)] font-semibold">
                    Not in a group
                  </h2>
                  <span className="text-xs text-[var(--ink-subtle)] font-normal">
                    ({ungrouped.length})
                  </span>
                </header>
                <SectionTable nodes={ungrouped} onRowClick={handleRowClick} />
              </section>
            )
          })()}

          {/* Notes */}
          {(() => {
            const notes = allNodes.filter((n) => n.kind === 'note')
            if (notes.length === 0) return null
            return (
              <section className="mb-6">
                <header className="flex items-center gap-2 mb-2">
                  <h2 className="wa-overline m-0 text-[var(--ink)] font-semibold">Notes</h2>
                  <span className="text-xs text-[var(--ink-subtle)] font-normal">
                    ({notes.length})
                  </span>
                </header>
                <SectionTable nodes={notes} onRowClick={handleRowClick} />
              </section>
            )
          })()}
        </div>
      )}

      {/* Group By: Tag */}
      {groupBy === 'tag' && (
        <div>
          {(() => {
            const tagSet = new Set<string>()
            for (const n of allNodes) {
              for (const t of n.tags) {
                if (t.trim()) tagSet.add(t.trim())
              }
            }
            const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b))
            const untagged = allNodes.filter((n) => n.tags.length === 0)

            return (
              <>
                {sortedTags.map((tag) => {
                  const tagNodes = allNodes.filter((n) => n.tags.includes(tag))
                  return (
                    <section key={tag} className="mb-6">
                      <header className="flex items-center gap-2 mb-2">
                        <Icon name="tag" size={14} className="text-[var(--ink-muted)]" />
                        <h2 className="wa-overline m-0 text-[var(--ink)] font-semibold">#{tag}</h2>
                        <span className="text-xs text-[var(--ink-subtle)] font-normal">
                          ({tagNodes.length})
                        </span>
                      </header>
                      <SectionTable nodes={tagNodes} onRowClick={handleRowClick} />
                    </section>
                  )
                })}

                {untagged.length > 0 && (
                  <section className="mb-6">
                    <header className="flex items-center gap-2 mb-2">
                      <h2 className="wa-overline m-0 text-[var(--ink)] font-semibold">Untagged</h2>
                      <span className="text-xs text-[var(--ink-subtle)] font-normal">
                        ({untagged.length})
                      </span>
                    </header>
                    <SectionTable nodes={untagged} onRowClick={handleRowClick} />
                  </section>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
