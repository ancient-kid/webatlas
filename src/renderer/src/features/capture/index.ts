// The app's capture service, wired to the real browser pane, canvas, API and toasts.
import { toast } from 'sonner'
import { useAppStore } from '@renderer/store/appStore'
import { browser } from '../browser/browserControl'
import { READABILITY_SCRIPT } from '../browser/readability'
import { canvas } from '../canvas/canvasControl'
import { createCapture } from './capture'

export const capture = createCapture({
  browser,
  canvas,
  workspaceId: () => useAppStore.getState().workspace?.id ?? null,
  readabilityScript: READABILITY_SCRIPT,
  saveThumb: (ws, id, png) => window.api.thumb.save(ws, id, png),
  summarize: (text) => window.api.ai.summarize(text),
  toast: (message, options) => toast(message, options)
})
