import type { LocalMessage, QuickReply } from './types.ts'

/** Used when site settings are unreachable or have no (valid) `chatQuickReplies`. Mirrors the website. */
export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { ar: 'أهلاً، لسه متاح؟', en: 'Hi, is it still available?' },
  { ar: 'آخر سعر كام؟', en: "What's your best price?" },
  { ar: 'الاستلام منين؟', en: 'Where can I pick it up?' },
  { ar: 'عليه ضمان؟', en: 'Does it have a warranty?' },
]

/** Admin-provided chips, cleaned; a missing language falls back to the other one. */
export function resolveQuickReplies(raw: unknown): QuickReply[] {
  if (!Array.isArray(raw)) return DEFAULT_QUICK_REPLIES
  const out: QuickReply[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const { ar, en } = r as Record<string, unknown>
    const a = typeof ar === 'string' ? ar.trim() : ''
    const e = typeof en === 'string' ? en.trim() : ''
    if (!a && !e) continue
    out.push({ ar: a || e, en: e || a })
  }
  return out.length ? out : DEFAULT_QUICK_REPLIES
}

/** Highest confirmed message id (pending bubbles have negative ids); 0 when none. */
export function lastServerId(messages: LocalMessage[]): number {
  let max = 0
  for (const m of messages) if (m.id > max) max = m.id
  return max
}

/** Lowest confirmed message id, the `beforeId` cursor for older pages; 0 when none. */
export function firstServerId(messages: LocalMessage[]): number {
  let min = 0
  for (const m of messages) if (m.id > 0 && (min === 0 || m.id < min)) min = m.id
  return min
}

/** Optimistic text bubble shown until the server echo replaces it (matched by `clientMsgId`). */
export function makeTextDraft(args: {
  tempId: number
  conversationId: number
  senderId: number
  text: string
  clientMsgId: string
  now: string
}): LocalMessage {
  return {
    id: args.tempId,
    conversationId: args.conversationId,
    senderId: args.senderId,
    type: 'text',
    content: args.text,
    caption: args.text,
    attachments: [],
    clientMsgId: args.clientMsgId,
    isRead: false,
    meta: null,
    createdAt: args.now,
    localState: 'sending',
  }
}

export function setLocalState(messages: LocalMessage[], id: number, state: 'sending' | 'failed'): LocalMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, localState: state } : m))
}

/**
 * RFC 4122 v4 id for `clientMsgId`. Uses `crypto.randomUUID` when the runtime has it;
 * otherwise Math.random (fine for an idempotency key; expo-crypto is not installed and
 * this ships over OTA, so no native module can be added).
 */
export function uuidv4(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else {
      const r = Math.floor(Math.random() * 16)
      out += hex[i === 19 ? (r & 0x3) | 0x8 : r]
    }
  }
  return out
}
