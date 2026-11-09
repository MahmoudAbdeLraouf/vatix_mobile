import type { ChatAttachment, LocalMessage, LocalUpload } from './types.ts'

/** Server caps (vatix_backend/src/chat/chat-upload.config.ts, send-message.dto.ts). */
export const MAX_IMAGES_PER_MESSAGE = 10
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_CAPTION_LENGTH = 2000

/**
 * Picks the images that still fit in the tray (`currentCount` already in it).
 * `overflow` is true when some had to be dropped because the tray is full.
 */
export function capImages<T>(
  incoming: T[],
  currentCount: number,
  max: number = MAX_IMAGES_PER_MESSAGE,
): { accepted: T[]; overflow: boolean } {
  const room = Math.max(0, max - currentCount)
  return { accepted: incoming.slice(0, room), overflow: incoming.length > room }
}

/**
 * Grid shape for an image message (max 4 tiles):
 * 1 = single, 2 = side by side, 3 = 2x2 with the last tile spanning the row,
 * 4+ = 2x2 with `+extra` on the 4th tile. Same as the website.
 */
export function gridLayout(count: number): { shown: number; extra: number; spanLast: boolean } {
  const shown = Math.min(Math.max(count, 0), 4)
  return { shown, extra: Math.max(0, count - 4), spanLast: shown === 3 }
}

/** Height of a single-image grid `width` wide, from the image aspect (clamped so tall shots stay usable). */
export function singleImageHeight(width: number, w: number | null | undefined, h: number | null | undefined): number {
  if (!w || !h) return Math.round(width * 0.75)
  return Math.round(Math.min(Math.max((width * h) / w, width * 0.5), width * 1.35))
}

export type TrayStatus = 'uploading' | 'done' | 'error'

/** Send is allowed only once there is an image and every upload in the tray succeeded. */
export function trayReady(items: { status: TrayStatus }[]): boolean {
  return items.length > 0 && items.every((it) => it.status === 'done')
}

/** `tooLarge` (413, over the 15 MB server limit) cannot be retried; anything else can. */
export function trayError(status: number | undefined): 'tooLarge' | 'failed' {
  return status === 413 ? 'tooLarge' : 'failed'
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

/** Upload mime for a picker asset: the picker's own value, else from the extension, else jpeg. */
export function assetMime(asset: { uri: string; mimeType?: string | null; fileName?: string | null }): string {
  if (asset.mimeType) return asset.mimeType
  const name = asset.fileName || asset.uri
  const m = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(name)
  return (m && EXT_MIME[m[1].toLowerCase()]) || 'image/jpeg'
}

/** Mirrors the server's `messagePreview` for image messages (always Arabic, like the server). */
export function imagePreviewText(count: number, caption: string): string {
  const label = count >= 2 ? `📷 ${count} صور` : '📷 صورة'
  const c = caption.trim()
  return c ? `${label} · ${c}` : label
}

/**
 * Optimistic image bubble. `attachments` are the already uploaded files (so a retry can
 * re-send their ids); `localFiles` carry the local uris shown until the echo lands.
 */
export function makeImageDraft(args: {
  tempId: number
  conversationId: number
  senderId: number
  caption: string
  attachments: ChatAttachment[]
  localFiles: LocalUpload[]
  clientMsgId: string
  now: string
}): LocalMessage {
  const caption = args.caption.trim()
  return {
    id: args.tempId,
    conversationId: args.conversationId,
    senderId: args.senderId,
    type: 'image',
    content: imagePreviewText(args.attachments.length, caption),
    caption,
    attachments: args.attachments.map((a, i) => ({ ...a, position: i })),
    clientMsgId: args.clientMsgId,
    isRead: false,
    meta: null,
    createdAt: args.now,
    localState: 'sending',
    localFiles: args.localFiles,
  }
}

/** expo-image source; `cacheKey` keeps signed / rotated URLs from re-downloading. */
export type ImageSrc = { uri: string; cacheKey?: string }

export type GridSource = {
  key: string
  /** Shown in the bubble grid. */
  thumb: ImageSrc
  /** Shown in the full-screen viewer. */
  full: ImageSrc
  width: number | null
  height: number | null
}

/**
 * Images to draw for a message: the local uris while it is still a pending draft, the
 * server attachments (by position) once confirmed. Cache keys: `attachment-{id}` for the
 * full image, `attachment-{id}-thumb` for the thumbnail.
 */
export function gridSources(m: LocalMessage): GridSource[] {
  const local = (m.localFiles ?? []).filter((f) => f.kind === 'image')
  if (local.length) {
    return local.map((f, i) => ({
      key: `local-${i}`,
      thumb: { uri: f.uri },
      full: { uri: f.uri },
      width: f.width ?? null,
      height: f.height ?? null,
    }))
  }
  return m.attachments
    .filter((a) => a.kind === 'image')
    .sort((a, b) => a.position - b.position)
    .map((a) => {
      const full = { uri: a.url, cacheKey: `attachment-${a.id}` }
      return {
        key: `att-${a.id}`,
        thumb: a.thumbUrl ? { uri: a.thumbUrl, cacheKey: `attachment-${a.id}-thumb` } : full,
        full,
        width: a.width,
        height: a.height,
      }
    })
}
