/**
 * Hold-to-record mic + the recording strip. Imports expo-audio statically, so it must only ever
 * be loaded through `voiceComponents.ts` (which checks the native module exists first): on
 * runtimes 1.3.3-1.3.7 requiring this file would throw.
 *
 * Gesture (PanResponder on the mic): press and hold records; slide toward the strip (right in
 * RTL, left in LTR) to cancel; slide up to lock hands-free, after which the mic turns into a
 * send button and a trash button discards. Letting go while recording sends. Under 1 s is dropped.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { deleteAsync } from 'expo-file-system/legacy'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, spacing, type ThemeColors } from '@/constants/theme'
import { haptic } from '@/lib/chat/nativeCaps'
import { cancelProgress, clampDuration, finishDecision, interruptAction, meterToAmplitude, recorderTick, slideIntent } from '@/lib/chat/voice'
import { MAX_VOICE_MS, downsamplePeaks, formatDuration } from '@/lib/chat/waveform'
import { pauseVoicePlayback } from './VoicePlayer'

export type RecordedVoice = {
  uri: string
  /** `audio/mp4`: expo-audio's high-quality preset writes AAC in an .m4a container. */
  mime: string
  durationMs: number
  waveform: number[]
}

export type VoiceRecorderProps = {
  /** A finished note (>= 1 s) to send. */
  onRecorded: (voice: RecordedVoice) => void
  /** True while recording, so the composer can hide the text field and attach button. */
  onActiveChange?: (active: boolean) => void
  disabled?: boolean
}

type Phase = 'idle' | 'starting' | 'recording' | 'locked' | 'stopping'

const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }
const LIVE_BARS = 28

export function VoiceRecorder({ onRecorded, onActiveChange, disabled }: VoiceRecorderProps) {
  const { t, isRtl } = useLocale()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const recorder = useAudioRecorder(OPTIONS)
  const state = useAudioRecorderState(recorder, 100)

  const [phase, setPhaseState] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [slide, setSlide] = useState(0)
  const [live, setLive] = useState<number[]>([])
  const [shortHint, setShortHint] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const samples = useRef<number[]>([])
  const startedAt = useRef(0)
  const startAborted = useRef(false)
  const tapSend = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const meterRef = useRef<number | undefined>(undefined)
  meterRef.current = state.metering

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const flashHint = useCallback(() => {
    setShortHint(true)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setShortHint(false), 1800)
  }, [])

  const stopTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])

  const finish = useCallback(
    async (send: boolean) => {
      if (phaseRef.current !== 'recording' && phaseRef.current !== 'locked') return
      setPhase('stopping')
      stopTimer()
      const ms = Date.now() - startedAt.current
      let uri: string | null = null
      try {
        await recorder.stop()
        uri = recorder.uri
      } catch {
        uri = null
      }
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
      const wave = downsamplePeaks(samples.current)
      samples.current = []
      setLive([])
      setElapsed(0)
      setSlide(0)
      setPhase('idle')
      onActiveChange?.(false)
      if (send && uri && finishDecision(ms) === 'send') {
        onRecorded({ uri, mime: 'audio/mp4', durationMs: clampDuration(ms), waveform: wave })
        return
      }
      if (uri) deleteAsync(uri, { idempotent: true }).catch(() => {})
      if (send) flashHint() // too short
    },
    [flashHint, onActiveChange, onRecorded, recorder, setPhase, stopTimer],
  )

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle') return
    setPhase('starting')
    startAborted.current = false
    try {
      let perm = await getRecordingPermissionsAsync()
      if (!perm.granted) {
        if (perm.canAskAgain) perm = await requestRecordingPermissionsAsync()
        setPhase('idle')
        // The system dialog swallowed the touch: after a fresh grant the user holds again.
        if (!perm.granted && !perm.canAskAgain) {
          Alert.alert(t.chat.micDenied, undefined, [
            { text: t.cancel, style: 'cancel' },
            { text: t.settings, onPress: () => void Linking.openSettings() },
          ])
        }
        return
      }
      pauseVoicePlayback()
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      if (startAborted.current) {
        setPhase('idle')
        flashHint() // let go before the recorder was ready: a tap, not a hold
        return
      }
      recorder.record()
      samples.current = []
      startedAt.current = Date.now()
      setElapsed(0)
      setLive([])
      setPhase('recording')
      onActiveChange?.(true)
      haptic('medium')
      timer.current = setInterval(() => {
        // A tick that lands after finish() began (or after an interruption) must never send.
        if (phaseRef.current !== 'recording' && phaseRef.current !== 'locked') return
        const ms = Date.now() - startedAt.current
        setElapsed(ms)
        const amp = Math.round(meterToAmplitude(meterRef.current) * 100)
        samples.current.push(amp)
        setLive(prev => [...prev.slice(-(LIVE_BARS - 1)), amp])
        if (recorderTick(ms) === 'autostop') void api.current.finish(true)
      }, 100)
    } catch {
      setPhase('idle')
      onActiveChange?.(false)
      stopTimer()
    }
  }, [flashHint, onActiveChange, recorder, setPhase, stopTimer, t])

  // The gesture handlers are created once, so they call through this always-fresh bag.
  const api = useRef({ start, finish, isRtl, disabled })
  api.current = { start, finish, isRtl, disabled }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !api.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (phaseRef.current === 'locked') {
          tapSend.current = true
          return
        }
        tapSend.current = false
        void api.current.start()
      },
      onPanResponderMove: (_e, g) => {
        if (phaseRef.current !== 'recording') return
        const intent = slideIntent(g.dx, g.dy, api.current.isRtl)
        if (intent === 'cancel') {
          haptic('light')
          void api.current.finish(false)
        } else if (intent === 'lock') {
          haptic('light')
          setSlide(0)
          setPhase('locked')
        } else {
          setSlide(Math.round(cancelProgress(g.dx, api.current.isRtl) * 20) / 20)
        }
      },
      onPanResponderRelease: () => {
        const p = phaseRef.current
        if (p === 'starting') startAborted.current = true
        else if (p === 'recording') void api.current.finish(true)
        else if (p === 'locked' && tapSend.current) void api.current.finish(true)
      },
      onPanResponderTerminate: () => {
        const p = phaseRef.current
        if (p === 'starting') startAborted.current = true
        else if (p === 'recording') void api.current.finish(false)
      },
    }),
  ).current

  // Leaving the foreground cancels: a locked recording has no gesture to end it, and on iOS the
  // OS interrupts the recorder while wall-clock time keeps running. finish() is single-shot
  // (phase guard), so this cannot race the 3:00 auto-stop or a release into a double finish.
  const interrupt = useCallback((appState: string) => {
    const action = interruptAction(phaseRef.current, appState)
    if (action === 'cancel') void api.current.finish(false)
    else if (action === 'abort-start') startAborted.current = true
  }, [])
  useEffect(() => {
    const sub = AppState.addEventListener('change', interrupt)
    return () => sub.remove()
  }, [interrupt])
  // The thread stays mounted under a pushed screen, so unmount cleanup never runs: cancel on blur.
  // finish(false) also reports onActiveChange(false), which stops the 'voice' typing re-emit.
  useFocusEffect(
    useCallback(() => () => interrupt('blur'), [interrupt]),
  )

  useEffect(
    () => () => {
      stopTimer()
      if (hintTimer.current) clearTimeout(hintTimer.current)
      if (phaseRef.current === 'recording' || phaseRef.current === 'locked') {
        recorder.stop().catch(() => {})
        onActiveChange?.(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const active = phase === 'recording' || phase === 'locked' || phase === 'stopping'
  const locked = phase === 'locked'
  const remaining = MAX_VOICE_MS - elapsed

  return (
    <View style={[styles.root, active && styles.rootActive]}>
      {active ? (
        <View style={styles.strip}>
          {locked ? (
            <Pressable
              onPress={() => {
                haptic('light')
                void finish(false)
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.chat.discardVoice}
              style={styles.trash}
            >
              <Ionicons name="trash-outline" size={22} color={colors.red} />
            </Pressable>
          ) : (
            <View style={styles.dot} />
          )}
          <Text style={[styles.timer, remaining <= 10_000 && styles.timerWarn]}>{formatDuration(elapsed)}</Text>
          <View style={styles.meter}>
            {live.map((v, i) => (
              <View key={i} style={[styles.meterBar, { height: Math.max(3, (v / 100) * 22) }]} />
            ))}
          </View>
          {!locked ? (
            <View style={[styles.slideHint, { opacity: 1 - slide }]}>
              <Ionicons name={isRtl ? 'chevron-forward' : 'chevron-back'} size={14} color={colors.subtle} />
              <Text style={styles.slideText}>{t.chat.slideToCancel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.micWrap}>
        {phase === 'recording' ? (
          <View style={styles.lockHint} pointerEvents="none">
            <Ionicons name="lock-closed" size={14} color={colors.subtle} />
            <Ionicons name="chevron-up" size={14} color={colors.subtle} />
          </View>
        ) : null}
        {shortHint && !active ? (
          <View style={styles.tip} pointerEvents="none">
            <Text style={styles.tipText}>{t.chat.holdToRecord}</Text>
          </View>
        ) : null}
        <View
          {...responder.panHandlers}
          accessible
          accessibilityRole="button"
          accessibilityLabel={locked ? t.chat.sendVoice : t.chat.recordVoice}
          style={[styles.mic, active && !locked && styles.micLive, disabled && styles.micDisabled]}
        >
          <Ionicons
            name={locked ? 'send' : 'mic'}
            size={22}
            color={active && !locked ? colors.white : colors.dk}
            style={locked && isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </View>
      </View>
    </View>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rootActive: { flex: 1 },
    strip: {
      flex: 1,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 24,
      backgroundColor: colors.inputBg,
    },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
    trash: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    timer: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, minWidth: 38 },
    timerWarn: { color: colors.red },
    meter: { flex: 1, height: 24, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' },
    meterBar: { width: 2.5, borderRadius: 2, backgroundColor: colors.y },
    slideHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    slideText: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtle },
    micWrap: { alignItems: 'center', justifyContent: 'center' },
    mic: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.y,
    },
    micLive: { backgroundColor: colors.red, transform: [{ scale: 1.2 }] },
    micDisabled: { opacity: 0.5 },
    lockHint: {
      position: 'absolute',
      bottom: 66,
      width: 32,
      paddingVertical: 8,
      borderRadius: 16,
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.inputBg,
    },
    tip: {
      position: 'absolute',
      bottom: 56,
      end: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.dk,
      minWidth: 140,
    },
    tipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.white, textAlign: 'center' },
  })
