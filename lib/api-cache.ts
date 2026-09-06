// ─── In-memory GET cache ─────────────────────────────────────────────────────
// Public GETs (categories, brands, product/store lists) are re-hit every time
// the user switches tabs, since RN unmounts screen state on some transitions.
// A short-lived module-level cache dedupes these AND — critically — merges
// simultaneous in-flight requests when two screens mount at once. Only wraps
// pure public GETs; anything user-scoped or mutation-adjacent bypasses it.
//
// Lives in its own module so both `lib/api.ts` (readers) and `lib/auth.ts`
// (mutation write helpers, which invalidate on success) can import without
// creating a circular dependency.
type CacheEntry<T> =
  | { kind: 'value'; value: T; expiresAt: number }
  | { kind: 'inflight'; promise: Promise<T> }

const _cache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL_MS = 60_000

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now()
  const hit = _cache.get(key)
  if (hit) {
    if (hit.kind === 'value' && hit.expiresAt > now) {
      return Promise.resolve(hit.value as T)
    }
    if (hit.kind === 'inflight') {
      return hit.promise as Promise<T>
    }
  }
  const promise = fetcher()
    .then(value => {
      _cache.set(key, { kind: 'value', value, expiresAt: Date.now() + ttl })
      return value
    })
    .catch(err => {
      // Only evict if we're still the in-flight entry — a concurrent success
      // may already have written a fresh value.
      if (_cache.get(key)?.kind === 'inflight') _cache.delete(key)
      throw err
    })
  _cache.set(key, { kind: 'inflight', promise })
  return promise
}

/** Wipe all cached GETs. Called on pull-to-refresh and after mutations. */
export function clearApiCache(): void {
  _cache.clear()
}
