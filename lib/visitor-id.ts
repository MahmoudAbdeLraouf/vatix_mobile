import * as SecureStore from 'expo-secure-store'

// Anonymous device identifier for retroactive event-log linking. On first launch
// we mint a UUID, store it in SecureStore, and send it via X-Visitor-Id on every
// analytics/auth call. When the user later logs in or registers, the backend
// runs UPDATE product_views SET viewerId=? WHERE visitorId=? AND viewerId IS NULL
// so anonymous events count toward the user's unique-view totals.
const KEY = 'vatix_vid'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let _cached: string | null = null

// Backend rejects non-UUID visitor ids, so avoid relying on `crypto.randomUUID`
// (missing on Hermes) and generate a v4-shaped string ourselves as a fallback.
function mint(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function getOrCreateVisitorId(): Promise<string> {
  if (_cached) return _cached
  try {
    const existing = await SecureStore.getItemAsync(KEY)
    if (existing && UUID_RE.test(existing)) {
      _cached = existing
      return existing
    }
    // else: stored value is malformed (older builds used a `vid-…` prefix that
    // the backend rejects) — fall through and mint a fresh UUID.
  } catch {
    // SecureStore read failed — fall through to mint a fresh (memory-only) id.
  }
  const fresh = mint()
  _cached = fresh
  try {
    await SecureStore.setItemAsync(KEY, fresh)
  } catch {
    // Persist failed — keep the in-memory value so the session stays consistent.
  }
  return fresh
}

export async function visitorIdHeader(): Promise<Record<string, string>> {
  try {
    return { 'X-Visitor-Id': await getOrCreateVisitorId() }
  } catch {
    return {}
  }
}
