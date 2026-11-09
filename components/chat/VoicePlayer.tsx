/**
 * Voice-note bubble body. Imports expo-audio statically, so it must only ever be loaded through
 * `voiceComponents.ts` (which checks the native module exists first): on runtimes 1.3.3-1.3.7
 * requiring this file would throw.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, spacing, type ThemeColors } from '@/constants/theme'
import { createPlaybackCoordinator } from '@/lib/chat/playback'
import { nextRate, playedFraction, rateLabel, seekFraction } from '@/lib/chat/voice'
import { WAVEFORM_BUCKETS, formatDuration } from '@/lib/chat/waveform'

export type VoicePlayerProps = {
  url: string
  durationMs: number
  waveform: number[]
  mine: boolean
}

/** One native player for the whole chat: only one voice note is ever audible. */
let shared: AudioPlayer | null = null
const coordinator = createPlaybackCoordinator()
let nextId = 0

function sharedPlayer(): AudioPlayer {
  if (!shared) shared = createAudioPlayer(null, { updateInterval: 100 })
  return shared
}

/** Pause whatever is playing (used before the recorder takes the microphone). */
export function pauseVoicePlayback(): void {
  try {
    shared?.pause()
  } catch {
    // nothing to pause
  }
}

const BAR_MAX = 26
const BAR_MIN = 3

export function VoicePlayer({ url, durationMs, waveform, mine }: VoicePlayerProps) {
  const { t, isRtl } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const idRef = useRef<string>('')
  if (!idRef.current) idRef.current = `voice-${++nextId}`
  const id = idRef.current

  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [rate, setRate] = useState(1)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)

  // The rest of the component's state, readable from native callbacks without stale closures.
  const positionRef = useRef(0)
  const rateRef = useRef(1)
  const subRef = useRef<{ remove(): void } | null>(null)
  positionRef.current = positionMs
  rateRef.current = rate

  const detach = useCallback(() => {
    subRef.current?.remove()
    subRef.current = null
  }, [])

  const onStatus = useCallback(
    (s: AudioStatus) => {
      if (!coordinator.isOwner(id)) return
      if (s.didJustFinish) {
        setPlaying(false)
        setPositionMs(0)
        positionRef.current = 0
        detach()
        coordinator.release(id)
        return
      }
      setPlaying(s.playing)
      setPositionMs(Math.round(s.currentTime * 1000))
    },
    [detach, id],
  )

  // Another note took the player (or we are unmounting): stop showing as playing, keep the spot.
  const onYield = useCallback(() => {
    detach()
    setPlaying(false)
  }, [detach])

  useEffect(
    () => () => {
      subRef.current?.remove()
      subRef.current = null
      if (coordinator.isOwner(id)) {
        pauseVoicePlayback()
        coordinator.release(id)
      }
    },
    [id],
  )

  async function toggle() {
    try {
      const player = sharedPlayer()
      if (coordinator.isOwner(id)) {
        if (playing) {
          player.pause()
          setPlaying(false)
        } else {
          player.play()
          player.setPlaybackRate(rateRef.current, 'high')
          setPlaying(true)
        }
        return
      }
      coordinator.claim(id, onYield)
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false })
      if (!coordinator.isOwner(id)) return // someone else claimed while the audio mode was changing
      player.replace({ uri: url })
      detach()
      subRef.current = player.addListener('playbackStatusUpdate', onStatus)
      if (positionRef.current > 0) await player.seekTo(positionRef.current / 1000)
      player.play()
      player.setPlaybackRate(rateRef.current, 'high')
      setPlaying(true)
      setFailed(false)
    } catch {
      detach()
      coordinator.release(id)
      setPlaying(false)
      setFailed(true)
    }
  }

  function cycleRate() {
    const next = nextRate(rate)
    setRate(next)
    rateRef.current = next
    if (coordinator.isOwner(id)) {
      try {
        sharedPlayer().setPlaybackRate(next, 'high')
      } catch {
        // the next play() applies it
      }
    }
  }

  const total = durationMs > 0 ? durationMs : 0
  function seek(e: GestureResponderEvent) {
    if (!(total > 0)) return
    const target = Math.round(seekFraction(e.nativeEvent.locationX, width, isRtl) * total)
    setPositionMs(target)
    positionRef.current = target
    if (coordinator.isOwner(id)) sharedPlayer().seekTo(target / 1000).catch(() => {})
  }

  const progress = playedFraction(positionMs, total)
  const bars = waveform.length ? waveform : new Array<number>(WAVEFORM_BUCKETS).fill(0)
  const shown = playing || positionMs > 0 ? positionMs : total
  const playedColor = mine ? colors.y : colors.dk
  const unplayedColor = mine ? 'rgba(255,255,255,0.45)' : colors.border

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? t.chat.pauseVoice : t.chat.playVoice}
        style={({ pressed }) => [styles.playBtn, mine ? styles.playBtnMine : styles.playBtnTheirs, pressed && styles.pressed]}
      >
        <Ionicons
          name={failed ? 'alert' : playing ? 'pause' : 'play'}
          size={18}
          color={mine ? colors.dk : colors.white}
          style={!playing && !failed && !isRtl ? { marginStart: 2 } : undefined}
        />
      </Pressable>
      <View
        style={styles.wave}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderRelease={seek}
        accessibilityRole="adjustable"
        accessibilityLabel={t.chat.voiceMessage}
      >
        {bars.map((v, i) => {
          const done = (i + 0.5) / bars.length <= progress
          return (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.bar,
                { height: Math.max(BAR_MIN, (Math.min(100, Math.max(0, v)) / 100) * BAR_MAX), backgroundColor: done ? playedColor : unplayedColor },
              ]}
            />
          )
        })}
      </View>
      <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>{formatDuration(shown)}</Text>
      <Pressable
        onPress={cycleRate}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t.chat.playbackSpeed}
        style={({ pressed }) => [styles.rate, mine ? styles.rateMine : styles.rateTheirs, pressed && styles.pressed]}
      >
        <Text style={[styles.rateText, mine ? styles.timeMine : styles.timeTheirs]}>{rateLabel(rate)}</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: 250, maxWidth: '100%' },
    playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    playBtnMine: { backgroundColor: colors.y },
    playBtnTheirs: { backgroundColor: dark ? colors.y : colors.dk },
    wave: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bar: { width: 2.5, borderRadius: 2 },
    time: { fontFamily: fonts.regular, fontSize: 11, minWidth: 30, textAlign: 'center' },
    timeMine: { color: colors.white },
    timeTheirs: { color: colors.muted },
    rate: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, minWidth: 34, alignItems: 'center' },
    rateMine: { backgroundColor: 'rgba(255,255,255,0.18)' },
    rateTheirs: { backgroundColor: colors.inputBg },
    rateText: { fontFamily: fonts.semiBold, fontSize: 11 },
    pressed: { opacity: 0.7 },
  })
