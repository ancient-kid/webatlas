import { create } from 'zustand'

/** Transient canvas state that is never saved: which card or label is being edited. */
interface CanvasUiState {
  editingId: string | null
  setEditing(id: string | null): void
}

export const useCanvasUi = create<CanvasUiState>()((set) => ({
  editingId: null,
  setEditing: (editingId) => set({ editingId })
}))
