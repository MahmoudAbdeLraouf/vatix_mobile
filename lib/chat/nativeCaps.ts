/**
 * OTA-safe access to the native modules added in 1.3.8 (expo-audio, expo-image-manipulator,
 * expo-haptics). This JS also ships over the air to runtimes 1.3.3-1.3.7, whose binaries do not
 * contain them. expo-audio and expo-image-manipulator call requireNativeModule when imported, so
 * importing them on an old runtime throws at load. Nothing outside this file (and the lazily
 * required voice components) may import those packages statically: probe the registered native
 * module first, and only then require() the package.
 */
import { requireOptionalNativeModule } from 'expo'
import { resizeTarget } from './resize'

type Probe = 'ExpoAudio' | 'ExpoImageManipulator' | 'ExpoHaptics'

const probed = new Map<Probe, boolean>()

function has(name: Probe): boolean {
  let v = probed.get(name)
  if (v === undefined) {
    try {
      v = requireOptionalNativeModule(name) != null
    } catch {
      v = false
    }
    probed.set(name, v)
  }
  return v
}

/** True when this binary can record and play voice notes (1.3.8+). */
export const hasAudioModule = (): boolean => has('ExpoAudio')
export const hasImageManipulator = (): boolean => has('ExpoImageManipulator')
export const hasHaptics = (): boolean => has('ExpoHaptics')

export type HapticKind = 'light' | 'medium' | 'success' | 'warning'

/** Fire-and-forget haptic; a no-op on runtimes without expo-haptics or when it fails. */
export function haptic(kind: HapticKind = 'light'): void {
  if (!hasHaptics()) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const H = require('expo-haptics') as typeof import('expo-haptics')
    const run =
      kind === 'success'
        ? H.notificationAsync(H.NotificationFeedbackType.Success)
        : kind === 'warning'
          ? H.notificationAsync(H.NotificationFeedbackType.Warning)
          : H.impactAsync(kind === 'medium' ? H.ImpactFeedbackStyle.Medium : H.ImpactFeedbackStyle.Light)
    run.catch(() => {})
  } catch {
    // haptics are decoration only
  }
}

export type ResizedImage = { uri: string; mime: string; width?: number; height?: number }

/**
 * Scale a photo so its longest edge is at most 1600 px and re-encode it as JPEG. Returns the
 * original untouched when the module is absent (old runtime), the size is unknown or already
 * small, or the manipulation fails: a failed resize must never block the send.
 */
export async function resizeForUpload(uri: string, mime: string, width?: number | null, height?: number | null): Promise<ResizedImage> {
  const original: ResizedImage = { uri, mime, width: width ?? undefined, height: height ?? undefined }
  const target = resizeTarget(width, height)
  if (!target || !hasImageManipulator()) return original
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const M = require('expo-image-manipulator') as typeof import('expo-image-manipulator')
    const out = await M.manipulateAsync(uri, [{ resize: { width: target.width, height: target.height } }], { compress: 0.8, format: M.SaveFormat.JPEG })
    return { uri: out.uri, mime: 'image/jpeg', width: out.width, height: out.height }
  } catch {
    return original
  }
}
