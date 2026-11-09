import React, { forwardRef, useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { getVoiceRecorder, type RecordedVoice } from '@/components/chat/voiceComponents'

type Props = {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onBlur?: () => void
  /** The ＋ button (camera / photo library); hidden when not given. */
  onAttach?: () => void
  /** A finished voice note. The mic only shows when given AND this binary has expo-audio. */
  onVoice?: (voice: RecordedVoice) => void
  /** Recording started / ended (e.g. to broadcast the `voice` typing indicator). */
  onVoiceActive?: (active: boolean) => void
}

/**
 * Text composer with an optional ＋ (attach photos) and, while the field is empty, a hold-to-
 * record mic in place of send. Always editable: sending is optimistic, so the field is cleared
 * at once and a failed send is retried from its bubble rather than restored here.
 * The mic exists only when the binary has expo-audio (1.3.8+): this JS also runs over the air on
 * older runtimes, where `getVoiceRecorder()` is null and the composer is text-and-photos only.
 */
export const Composer = forwardRef<TextInput, Props>(function Composer(
  { value, onChangeText, onSend, onBlur, onAttach, onVoice, onVoiceActive },
  ref,
) {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const empty = !value.trim()
  const Recorder = onVoice ? getVoiceRecorder() : null
  const [recording, setRecording] = useState(false)
  const handleActive = useCallback(
    (active: boolean) => {
      setRecording(active)
      onVoiceActive?.(active)
    },
    [onVoiceActive],
  )

  return (
    <View style={styles.bar}>
      {onAttach && !recording ? (
        <Pressable
          style={({ pressed }) => [styles.attachBtn, pressed && styles.attachBtnPressed]}
          onPress={onAttach}
          accessibilityRole="button"
          accessibilityLabel={t.chat.attach}
        >
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={[styles.pill, recording && styles.hidden]}>
        <TextInput
          ref={ref}
          style={[styles.input, dirStyle]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={t.typeMessage}
          placeholderTextColor={colors.subtle}
          multiline
          maxLength={2000}
        />
      </View>
      {Recorder && empty ? (
        <Recorder onRecorded={onVoice!} onActiveChange={handleActive} />
      ) : (
      <Pressable
        style={({ pressed }) => [styles.sendBtn, empty && styles.sendBtnDisabled, pressed && !empty && styles.sendBtnPressed]}
        onPress={onSend}
        disabled={empty}
        accessibilityRole="button"
        accessibilityLabel={t.send}
      >
        <Ionicons
          name="send"
          size={20}
          color={empty ? colors.subtle : colors.dk}
          style={ar ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      </Pressable>
      )}
    </View>
  )
})

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.xs,
    },
    pill: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
      minHeight: 48,
      maxHeight: 140,
    },
    input: {
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
      paddingVertical: Platform.OS === 'ios' ? 13 : 9,
      padding: 0,
      margin: 0,
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.y,
      alignItems: 'center',
      justifyContent: 'center',
      ...(dark ? null : shadow.sm),
    },
    sendBtnDisabled: {
      backgroundColor: colors.placeholder,
      borderWidth: 1,
      borderColor: colors.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    attachBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Kept mounted (not unmounted) while recording so the text field keeps focus and its ref.
    hidden: { display: 'none' },
    attachBtnPressed: { opacity: 0.7 },
    sendBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.94 }],
    },
  })
