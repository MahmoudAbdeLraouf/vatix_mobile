import { Platform } from 'react-native'
import {
  FileSystemSessionType,
  FileSystemUploadType,
  createUploadTask,
  type UploadTask,
} from 'expo-file-system/legacy'
import { getToken, refreshAccessToken } from '@/lib/auth'
import { visitorIdHeader } from '@/lib/visitor-id'
import type { ChatAttachment } from './types.ts'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'

/** Rejection of `uploadAttachment`: `status` is the HTTP status (0 = network / no response). */
export class UploadError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'UploadError'
    this.status = status
  }
}

function abortError(): Error {
  const e = new Error('Upload aborted')
  e.name = 'AbortError'
  return e
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}

function errorMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    const m = parsed?.message
    if (typeof m === 'string' && m) return m
    if (Array.isArray(m) && typeof m[0] === 'string') return m[0]
  } catch {
    // non-JSON body (e.g. an nginx 413 page)
  }
  return `Upload failed (${status})`
}

/**
 * Uploads one local file to `POST /conversations/:id/attachments` (multipart, field `file`,
 * plus text `fields`, e.g. `{ kind: 'image' }`). Progress is 0-99 while the bytes go out and
 * only reaches 100 once the server answered. A 401 refreshes the session and retries once.
 * Rejects with `UploadError` (`status`) on a non-2xx answer, or an `AbortError` once `signal`
 * aborts (the native task is cancelled).
 */
export async function uploadAttachment(
  conversationId: number,
  localUri: string,
  mime: string,
  fields: Record<string, string>,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<ChatAttachment> {
  if (signal?.aborted) throw abortError()
  let refreshed = false
  for (;;) {
    // Each await below is a window where the user can hit ✕; re-check before doing more work.
    const token = await getToken()
    if (signal?.aborted) throw abortError()
    const visitor = await visitorIdHeader()
    if (signal?.aborted) throw abortError()
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Client-Platform': Platform.OS,
      ...visitor,
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const task: UploadTask = createUploadTask(
      `${BASE}/conversations/${conversationId}/attachments`,
      localUri,
      {
        httpMethod: 'POST',
        // A background session (the iOS default) keeps retrying while offline instead of failing.
        sessionType: FileSystemSessionType.FOREGROUND,
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mime,
        parameters: fields,
        headers,
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (!onProgress || totalBytesExpectedToSend <= 0) return
        onProgress(Math.min(99, Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)))
      },
    )

    let aborted = false
    const onAbort = () => {
      aborted = true
      task.cancelAsync().catch(() => {})
    }
    // Registered before uploadAsync starts; nothing awaits between creation and here, so an
    // abort can only land after this point, where onAbort cancels the native task.
    signal?.addEventListener('abort', onAbort)

    let res: Awaited<ReturnType<UploadTask['uploadAsync']>>
    try {
      res = await task.uploadAsync()
    } catch (e) {
      if (aborted || signal?.aborted) throw abortError()
      throw new UploadError(e instanceof Error ? e.message : 'Network error', 0)
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
    // A cancelled task resolves to null / undefined.
    if (aborted || !res || signal?.aborted) throw abortError()

    if (res.status === 401 && !refreshed) {
      refreshed = true
      const ok = await refreshAccessToken()
      if (signal?.aborted) throw abortError()
      if (ok) continue
    }
    if (res.status < 200 || res.status >= 300) {
      throw new UploadError(errorMessage(res.body, res.status), res.status)
    }
    let attachment: ChatAttachment
    try {
      attachment = JSON.parse(res.body) as ChatAttachment
    } catch {
      throw new UploadError('Bad upload response', res.status)
    }
    onProgress?.(100)
    return attachment
  }
}
