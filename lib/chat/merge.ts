import type { ChatMessage, LocalMessage } from './types.ts'

/** Optimistic messages carry a negative temp id until the server confirms them. */
const isPending = (m: LocalMessage): boolean => m.id < 0

/**
 * Merge server messages into a thread. Safe to call with overlapping data from any source
 * (REST page, POST response, socket echo, reconnect catch-up).
 *
 * - An incoming message whose `clientMsgId` matches a pending local bubble replaces it.
 * - Server messages are de-duplicated by `id` (last write wins) and sorted by `id` ascending.
 * - Still-pending local bubbles stay after them, in their original order.
 */
export function mergeMessages(current: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  const confirmed = new Set<string>()
  for (const m of incoming) if (m.clientMsgId) confirmed.add(m.clientMsgId)

  const byId = new Map<number, LocalMessage>()
  const pending: LocalMessage[] = []
  for (const m of current) {
    if (isPending(m)) {
      if (m.clientMsgId && confirmed.has(m.clientMsgId)) continue
      pending.push(m)
    } else {
      byId.set(m.id, m)
    }
  }
  for (const m of incoming) byId.set(m.id, m)

  const server = [...byId.values()].sort((a, b) => a.id - b.id)
  return [...server, ...pending]
}
