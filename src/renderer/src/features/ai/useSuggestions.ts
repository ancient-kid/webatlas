import { useMemo } from 'react'
import type { Ghost } from '@shared/types'
import { useBoardStore } from '@renderer/store/boardStore'
import { visibleGhosts } from './ghostsToFlow'

/** The suggestions shown to the student (applicable, confident enough), in panel order. */
export function useSuggestions(): Ghost[] {
  const board = useBoardStore((s) => s.board)
  return useMemo(() => visibleGhosts(board), [board])
}

export function useSuggestionCount(): number {
  return useSuggestions().length
}
