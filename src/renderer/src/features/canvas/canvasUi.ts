import { create } from 'zustand'

/** The link menu opened by double-clicking a link, at the pointer position. */
export interface EdgeMenu {
  id: string
  x: number
  y: number
}

/** Transient canvas state that is never saved. */
interface CanvasUiState {
  /** Which card or label is being edited in place. */
  editingId: string | null
  edgeMenu: EdgeMenu | null
  setEditing(id: string | null): void
  openEdgeMenu(menu: EdgeMenu | null): void
}

export const useCanvasUi = create<CanvasUiState>()((set) => ({
  editingId: null,
  edgeMenu: null,
  setEditing: (editingId) => set({ editingId }),
  openEdgeMenu: (edgeMenu) => set({ edgeMenu })
}))
