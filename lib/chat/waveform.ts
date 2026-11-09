/** Pure voice-note helpers (no DOM) so they run under the node test runner. */
import type { ChatAttachment, LocalMessage, LocalUpload } from './types.ts'

export const WAVEFORM_BUCKETS = 48
/** Server cap (MAX_VOICE_MS): recording auto-stops and sends at 3:00. */
export const MAX_VOICE_MS = 180_000
/** Shorter recordings are discarded silently. */
export const MIN_VOICE_MS = 1_000

/**
 * Downsample raw amplitude samples to `buckets` peaks: the max |sample| per bucket,
 * scaled so the loudest bucket is 100. Always returns exactly `buckets` integers in 0–100.
 */
export function downsamplePeaks(samples: number[], buckets = WAVEFORM_BUCKETS): number[] {
  const out = new Array<number>(buckets).fill(0)
  const n = samples.length
  if (n === 0) return out
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor((i * n) / buckets)
    const end = Math.min(n, Math.max(start + 1, Math.floor(((i + 1) * n) / buckets)))
    let peak = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(samples[j])
      if (Number.isFinite(v) && v > peak) peak = v
      else if (v === Infinity) peak = Number.MAX_VALUE
    }
    out[i] = peak
  }
  const max = Math.max(...out)
  if (!(max > 0)) return out.fill(0)
  return out.map(v => Math.max(0, Math.min(100, Math.round((v / max) * 100))))
}

/** m:ss, clamped at zero. */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** audio/mp4 when the browser can record it (Safari, newer Chrome), else webm/opus; '' = browser default. */
export function pickRecorderMime(isTypeSupported: (type: string) => boolean): string {
  for (const type of ['audio/mp4', 'audio/webm;codecs=opus']) {
    if (isTypeSupported(type)) return type
  }
  return ''
}

/** 'audio/webm;codecs=opus' → 'audio/webm' (the server filters on the base mime). */
export function baseMime(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase()
}

const EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
}

export function voiceFileName(mime: string): string {
  return `voice.${EXTENSIONS[baseMime(mime)] ?? 'webm'}`
}

/** Upload form fields for a voice note (multipart strings; the server normalises the waveform). */
export function voiceUploadFields(durationMs: number, waveform: number[]): Record<string, string> {
  return { kind: 'voice', durationMs: String(Math.max(0, Math.round(durationMs))), waveform: JSON.stringify(waveform) }
}

/**
 * Optimistic voice bubble. `attachments` starts empty and is filled once the upload
 * succeeds, so a retry after a failed POST re-sends the id instead of re-uploading.
 */
export function makeVoiceDraft(args: {
  tempId: number
  conversationId: number
  senderId: number
  localFile: LocalUpload
  clientMsgId: string
  now: string
}): LocalMessage {
  return {
    id: args.tempId,
    conversationId: args.conversationId,
    senderId: args.senderId,
    type: 'voice',
    content: '🎤 رسالة صوتية',
    caption: '',
    attachments: [],
    clientMsgId: args.clientMsgId,
    isRead: false,
    meta: null,
    createdAt: args.now,
    localState: 'sending',
    localFiles: [args.localFile],
  }
}

/** What a voice bubble plays: the server attachment when present, else the local recording. */
export function voiceSource(m: LocalMessage): { url: string; durationMs: number; waveform: number[] } | null {
  const att = m.attachments.find(a => a.kind === 'voice') ?? m.attachments[0]
  const local = m.localFiles?.find(f => f.kind === 'voice')
  const url = att?.url ?? local?.uri
  if (!url) return null
  return {
    url,
    durationMs: att?.durationMs ?? local?.durationMs ?? 0,
    waveform: att?.waveform ?? local?.waveform ?? [],
  }
}

/** After a successful upload: keep the attachment on the pending bubble so a retry only re-POSTs. */
export function withUploadedVoice(list: LocalMessage[], id: number, attachment: ChatAttachment): LocalMessage[] {
  return list.map(m => (m.id === id ? { ...m, attachments: [attachment] } : m))
}

/** `POST /conversations/:id/messages` body for a voice note (no content: the server fills the legacy text). */
export function voiceMessageBody(attachmentId: number, clientMsgId: string): { type: 'voice'; attachmentIds: number[]; clientMsgId: string } {
  return { type: 'voice', attachmentIds: [attachmentId], clientMsgId }
}
