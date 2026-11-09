/** Image resize math for uploads (no native imports so it runs under the node test runner). */

/** Longest edge sent to the server; bigger photos are scaled down before upload. */
export const MAX_IMAGE_EDGE = 1600

/**
 * Target size for a photo whose longest edge is capped at `max` (aspect ratio kept), or null
 * when it already fits or the size is unknown (upload the original untouched).
 */
export function resizeTarget(width: number | null | undefined, height: number | null | undefined, max = MAX_IMAGE_EDGE): { width: number; height: number } | null {
  if (!width || !height || !(width > 0) || !(height > 0)) return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (Math.max(width, height) <= max) return null
  const scale = max / Math.max(width, height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
