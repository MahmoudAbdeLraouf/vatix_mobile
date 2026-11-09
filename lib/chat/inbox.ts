import type { InboxItem } from './types.ts'

/**
 * Pure inbox list helpers (no React, no path aliases: the node test runner imports this file).
 * The inbox is ordered most-recently-active first, as the server returns it.
 */

/** Put `item` at the top, replacing any existing row with the same id. */
export function upsertToTop(list: InboxItem[], item: InboxItem): InboxItem[] {
  return [item, ...list.filter((c) => c.id !== item.id)]
}

/**
 * Live `conversation:updated` while a text search is active: only rows already in the (filtered)
 * list are refreshed and moved to the top; a conversation not in the list is never inserted
 * because we can't tell whether it matches the query.
 */
export function applyLiveUpdate(list: InboxItem[], item: InboxItem, searching: boolean): InboxItem[] {
  if (searching && !list.some((c) => c.id === item.id)) return list
  return upsertToTop(list, item)
}

/** Append the next page; rows already present (e.g. moved up by a live update) keep their place. */
export function appendPage(list: InboxItem[], page: InboxItem[]): InboxItem[] {
  const seen = new Set(list.map((c) => c.id))
  const out = list.slice()
  for (const c of page) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

/**
 * Silent refresh of page one (focus, reconnect, poll) without throwing away pages already
 * scrolled in: fresh rows first, then the loaded rows that were not in the fresh page.
 * `nextCursor` stays the old one when deeper pages were loaded, else it is the fresh page's.
 */
export function refreshFirstPage(
  list: InboxItem[],
  nextCursor: string | null,
  page: InboxItem[],
  pageCursor: string | null,
): { items: InboxItem[]; nextCursor: string | null } {
  const fresh = new Set(page.map((c) => c.id))
  const rest = list.filter((c) => !fresh.has(c.id))
  return { items: [...page, ...rest], nextCursor: rest.length > 0 ? nextCursor : pageCursor }
}
