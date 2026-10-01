import type { WebAtlasApi } from '../shared/api'

declare global {
  interface Window {
    /** Only `on` exists until T06 adds the request methods; then this becomes WebAtlasApi. */
    api: Pick<WebAtlasApi, 'on'>
  }
}

export {}
