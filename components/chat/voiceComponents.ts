/**
 * Lazy loaders for the voice UI. VoiceRecorder / VoicePlayer import expo-audio statically (its
 * hooks cannot be conditional), and expo-audio throws at import time on runtimes 1.3.3-1.3.7,
 * where the native module is missing. These JS bundles ship to those runtimes over the air, so
 * the components are only require()d after the native module is confirmed to exist. Everything
 * else imports from here and never from the two component files directly (type imports are
 * erased, so they are fine).
 */
import type { ComponentType } from 'react'
import { hasAudioModule } from '@/lib/chat/nativeCaps'
import type { VoiceRecorderProps } from './VoiceRecorder'
import type { VoicePlayerProps } from './VoicePlayer'

export type { RecordedVoice, VoiceRecorderProps } from './VoiceRecorder'
export type { VoicePlayerProps } from './VoicePlayer'

let recorder: ComponentType<VoiceRecorderProps> | null | undefined
let player: ComponentType<VoicePlayerProps> | null | undefined

/** The hold-to-record mic, or null on a binary without expo-audio. */
export function getVoiceRecorder(): ComponentType<VoiceRecorderProps> | null {
  if (recorder === undefined) {
    recorder = null
    if (hasAudioModule()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        recorder = (require('./VoiceRecorder') as typeof import('./VoiceRecorder')).VoiceRecorder
      } catch {
        recorder = null
      }
    }
  }
  return recorder
}

/** The voice-note player, or null on a binary without expo-audio. */
export function getVoicePlayer(): ComponentType<VoicePlayerProps> | null {
  if (player === undefined) {
    player = null
    if (hasAudioModule()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        player = (require('./VoicePlayer') as typeof import('./VoicePlayer')).VoicePlayer
      } catch {
        player = null
      }
    }
  }
  return player
}
