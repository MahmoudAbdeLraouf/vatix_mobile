import * as SecureStore from 'expo-secure-store'

// Anonymous device identifier for retroactive event-log linking. On first launch
// we mint a UUID, store it in SecureStore, and send it via X-Visitor-Id on every
// analytics/auth call. When the user later logs in or registers, the backend
// runs UPDATE product_views SET viewerId=? WHERE visitorId=? AND viewerId IS NULL
// so anonymous events count toward the user's unique-view totals.
const KEY = 'vatix_vid'

let _cached: string | null = null

function mint(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `vid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function getOrCreateVisitorId(): Promise<string> {
  if (_cached) return _cached
  try {
    const existing = await SecureStore.getItemAsync(KEY)
    if (existing) {
      _cached = existing
      return existing
    }
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
