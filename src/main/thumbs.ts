// Card thumbnails: PNG files under each workspace, served to the sandboxed renderer as
// `wa-thumb://<workspaceId>/<nodeId>.png?v=<time>` (the ?v= busts the image cache).
import { promises as fs } from 'node:fs'
import { atomicWrite } from './storage/atomicWrite'
import {
  assertNodeId,
  assertWorkspaceId,
  isNodeId,
  isWorkspaceId,
  thumbFile,
  wsFile
} from './storage/paths'

export const THUMB_SCHEME = 'wa-thumb'

const PNG_PREFIX = 'data:image/png;base64,'
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** Thumbnails are small page captures; anything bigger is refused. */
export const MAX_THUMB_BYTES = 5 * 1024 * 1024

export function thumbUrl(workspaceId: string, nodeId: string, version = Date.now()): string {
  return `${THUMB_SCHEME}://${workspaceId}/${nodeId}.png?v=${version}`
}

/** The ids in a thumbnail URL, or null if it isn't a valid one. */
export function parseThumbUrl(url: string): { workspaceId: string; nodeId: string } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${THUMB_SCHEME}:`) return null
  const match = /^\/([^/]+)\.png$/.exec(u.pathname)
  if (!match || !isWorkspaceId(u.hostname) || !isNodeId(match[1])) return null
  return { workspaceId: u.hostname, nodeId: match[1] }
}

/** Decodes a PNG data URL, checking the format and size. */
export function decodePng(dataUrl: unknown): Buffer {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) {
    throw new Error('Thumbnail must be a PNG data URL')
  }
  const bytes = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64')
  if (bytes.length > MAX_THUMB_BYTES) throw new Error('Thumbnail is too large')
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Thumbnail is not a PNG image')
  return bytes
}

/** Writes a PNG thumbnail into an existing workspace and returns its URL. */
export async function saveThumb(
  workspaceId: unknown,
  nodeId: unknown,
  dataUrl: unknown
): Promise<string> {
  const ws = assertWorkspaceId(workspaceId)
  const node = assertNodeId(nodeId)
  const bytes = decodePng(dataUrl)
  await fs.access(wsFile(ws)).catch(() => {
    throw new Error('Workspace not found')
  })
  await atomicWrite(thumbFile(ws, node), bytes)
  return thumbUrl(ws, node)
}

/** Handles a `wa-thumb://` request. */
export async function serveThumb(url: string): Promise<Response> {
  const ids = parseThumbUrl(url)
  if (!ids) return new Response('Bad thumbnail URL', { status: 400 })
  try {
    const bytes = await fs.readFile(thumbFile(ids.workspaceId, ids.nodeId))
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-cache',
        'access-control-allow-origin': '*'
      }
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
