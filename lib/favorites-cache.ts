import { authFetch } from '@/lib/auth'
import type { FavoriteProduct } from '@/lib/api'

// One `/products/favorites` fetch shared by every heart on screen — the products
// list mounts a FavoriteButton per row, and each fetching its own copy would fire
// dozens of identical requests. Keyed by user so an account switch never reuses
// the previous user's set; toggles write through so every heart stays in sync.

const STALE_MS = 60_000

let ownerId: number | null = null
let ids: Set<number> | null = null
let loadedAt = 0
let inFlight: Promise<Set<number> | null> | null = null
const listeners = new Set<() => void>()

function reset(userId: number) {
  ownerId = userId
  ids = null
  loadedAt = 0
  inFlight = null
}

export function primeFavorites(userId: number, list: FavoriteProduct[]) {
  if (ownerId !== userId) reset(userId)
  ids = new Set(list.map((f) => f.productId))
  loadedAt = Date.now()
  listeners.forEach((l) => l())
}

/** Resolves to null when the list can't be fetched (caller keeps its current state). */
export function loadFavoriteIds(userId: number): Promise<Set<number> | null> {
  if (ownerId !== userId) reset(userId)
  if (ids && Date.now() - loadedAt < STALE_MS) return Promise.resolve(ids)
  if (!inFlight) {
    const req: Promise<Set<number> | null> = authFetch<FavoriteProduct[]>('/products/favorites')
      .then((list) => {
        if (inFlight !== req) return ids
        if (!list) return null
        primeFavorites(userId, list)
        return ids
      })
      .catch(() => null)
      .finally(() => {
        if (inFlight === req) inFlight = null
      })
    inFlight = req
  }
  return inFlight
}

export function peekFavorite(userId: number, productId: number): boolean | undefined {
  return ownerId === userId && ids ? ids.has(productId) : undefined
}

// Only the signed-in user can toggle, so this always targets the cached owner's set.
export function markFavorite(productId: number, faved: boolean) {
  if (!ids) return
  if (faved) ids.add(productId)
  else ids.delete(productId)
  listeners.forEach((l) => l())
}

export function subscribeFavorites(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
