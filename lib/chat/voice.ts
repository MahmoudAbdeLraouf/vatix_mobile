/**
 * Pure voice-note logic (recorder limits, slide gestures, playback rate, waveform seek) so it
 * runs under the node test runner. No native imports: the recorder / player components call these.
 */
import { MAX_VOICE_MS, MIN_VOICE_MS } from './waveform.ts'

/** Slide this far (px) from the touch-down point to cancel. */
export const CANCEL_DX = 90
/** Slide this far (px) up to lock the recording hands-free. */
export const LOCK_DY = 70

export type RecorderTick = 'continue' | 'autostop'

/** Checked on every recorder poll: at 3:00 the note stops and sends by itself. */
export function recorderTick(elapsedMs: number): RecorderTick {
  return Number.isFinite(elapsedMs) && elapsedMs >= MAX_VOICE_MS ? 'autostop' : 'continue'
}

export type RecorderFinish = 'discard' | 'send'

/** What to do with a finished recording: anything under 1 s is dropped silently. */
export function finishDecision(elapsedMs: number): RecorderFinish {
  return Number.isFinite(elapsedMs) && elapsedMs >= MIN_VOICE_MS ? 'send' : 'discard'
}

/** Recording length reported to the server: never past the 3:00 cap. */
export function clampDuration(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0
  return Math.min(Math.round(elapsedMs), MAX_VOICE_MS)
}

export type SlideIntent = 'none' | 'cancel' | 'lock'

/**
 * Where the finger has gone since touch-down. Cancel is toward the screen's right in RTL and
 * its left in LTR; lock is up. When both thresholds are crossed the larger overshoot wins.
 */
export function slideIntent(dx: number, dy: number, isRtl: boolean): SlideIntent {
  const toward = isRtl ? dx : -dx
  const cancelOver = toward - CANCEL_DX
  const lockOver = -dy - LOCK_DY
  if (cancelOver < 0 && lockOver < 0) return 'none'
  return cancelOver >= lockOver ? 'cancel' : 'lock'
}

/** 0–1 progress toward cancelling, to fade the hint while sliding. */
export function cancelProgress(dx: number, isRtl: boolean): number {
  const toward = isRtl ? dx : -dx
  if (!Number.isFinite(toward) || toward <= 0) return 0
  return Math.min(1, toward / CANCEL_DX)
}

/** The meter reports dBFS (about -160..0); a -60 dB floor maps to 0, 0 dB to 1. */
export function meterToAmplitude(db: number | undefined): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0
  const FLOOR = -60
  if (db <= FLOOR) return 0
  return Math.min(1, (db - FLOOR) / -FLOOR)
}

export const PLAYBACK_RATES = [1, 1.5, 2] as const

/** 1× → 1.5× → 2× → 1×; an unknown rate restarts at 1×. */
export function nextRate(rate: number): number {
  const i = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number])
  return PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length]
}

export function rateLabel(rate: number): string {
  return `${rate}×`
}

/** 0–1 position of a tap at `x` on a waveform `width` wide (the bars are mirrored in RTL). */
export function seekFraction(x: number, width: number, isRtl: boolean): number {
  if (!(width > 0) || !Number.isFinite(x)) return 0
  const f = Math.max(0, Math.min(1, x / width))
  return isRtl ? 1 - f : f
}

/** 0–1 playback progress. */
export function playedFraction(positionMs: number, durationMs: number): number {
  if (!(durationMs > 0) || !Number.isFinite(positionMs)) return 0
  return Math.max(0, Math.min(1, positionMs / durationMs))
}

export type InterruptAction = 'none' | 'abort-start' | 'cancel'

/**
 * What the recorder does when the app's state changes (or the screen loses focus, which passes
 * 'background'-like input via `appState`). Leaving `active` while recording or locked cancels
 * (nothing is sent, the mic is released); during the start-up window it aborts the start.
 */
export function interruptAction(phase: string, appState: string): InterruptAction {
  if (appState === 'active') return 'none'
  if (phase === 'recording' || phase === 'locked') return 'cancel'
  if (phase === 'starting') return 'abort-start'
  return 'none'
}
