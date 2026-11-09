/**
 * One voice note plays at a time. The single shared native player belongs to whichever bubble
 * last claimed it; claiming it tells the previous owner to drop back to "paused". Pure (no
 * native imports) so the hand-over rules are unit-tested.
 */
export interface PlaybackCoordinator {
  /** Take the player. A different current owner is told to yield first. */
  claim(id: string, onYield: () => void): void
  /** Give the player up (only if `id` still owns it; a no-op otherwise). */
  release(id: string): void
  isOwner(id: string): boolean
}

export function createPlaybackCoordinator(): PlaybackCoordinator {
  let owner: string | null = null
  let yieldFn: (() => void) | null = null
  return {
    claim(id, onYield) {
      const previous = owner !== null && owner !== id ? yieldFn : null
      owner = id
      yieldFn = onYield
      previous?.()
    },
    release(id) {
      if (owner !== id) return
      owner = null
      yieldFn = null
    },
    isOwner: (id) => owner === id,
  }
}
