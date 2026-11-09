import React, { memo, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BroMessage } from '@/components/bro/BroMessage'
import { ImageGrid } from '@/components/chat/ImageGrid'
import { ImageViewer } from '@/components/chat/ImageViewer'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { gridSources } from '@/lib/chat/images'
import type { LocalMessage } from '@/lib/chat/types'

function timeLabel(iso: string, ar: boolean): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

type Props = {
  message: LocalMessage
  mine: boolean
  /** Re-send a failed bubble (same `clientMsgId`). */
  onRetry: (message: LocalMessage) => void
  /** A Bro action was answered: catch up on the reply. */
  onBroAnswered: () => void
  /** Voice notes can't play in this build: send the user to the store listing. */
  onOpenStore: () => void
}

/**
 * One chat bubble. Status for my messages: 🕓 while sending, ✓ once stored, and a red
 * retry label when the send failed. There are intentionally no seen/read receipts.
 */
export const MessageBubble = memo(function MessageBubble({ message: m, mine, onRetry, onBroAnswered, onOpenStore }: Props) {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  // Local uris while the draft is pending, server attachments (stable cache keys) once echoed.
  const images = useMemo(
    () => (m.type === 'image' ? gridSources(m) : []),
    [m],
  )
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  if (m.meta?.bro) {
    return (
      <BroMessage
        message={{ id: m.id, content: m.content, meta: m.meta, createdAt: m.createdAt }}
        onAnswered={onBroAnswered}
      />
    )
  }

  const failed = m.localState === 'failed'
  const status = !mine || failed ? '' : m.localState === 'sending' ? '  🕓' : '  ✓'
  const textColor = mine ? styles.textMine : styles.textTheirs

  let body: React.ReactNode
  if (m.type === 'voice') {
    body = (
      <Pressable
        onPress={onOpenStore}
        accessibilityRole="link"
        style={({ pressed }) => [styles.voiceRow, pressed && styles.pressed]}
      >
        <Ionicons name="mic" size={18} color={mine ? colors.y : colors.yd} />
        <View style={styles.voiceText}>
          <Text style={[styles.voiceTitle, textColor, dirStyle]}>{t.chat.voiceMessage}</Text>
          <Text style={[styles.voiceHint, textColor, dirStyle]}>{t.chat.updateToListen}</Text>
        </View>
      </Pressable>
    )
  } else if (images.length) {
    body = (
      <>
        <ImageGrid sources={images} onOpen={setViewerIndex} />
        {m.caption ? <Text style={[styles.text, styles.caption, textColor, dirStyle]}>{m.caption}</Text> : null}
        <ImageViewer sources={images} index={viewerIndex} onClose={() => setViewerIndex(null)} />
      </>
    )
  } else {
    // Legacy image rows without attachments carry a text `content`.
    body = <Text style={[styles.text, textColor, dirStyle]}>{m.content}</Text>
  }

  // Website intentionally aligns "mine" to flex-start; mirror that here.
  return (
    <View style={[styles.row, { alignItems: mine ? 'flex-start' : 'flex-end' }]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          images.length > 0 && styles.bubbleImage,
          failed && styles.failed,
        ]}
      >
        {body}
        <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs, images.length > 0 && styles.timeImage]}>
          {timeLabel(m.createdAt, ar)}
          {status}
        </Text>
      </View>
      {mine && failed ? (
        <Pressable
          onPress={() => onRetry(m)}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={[styles.retryText, dirStyle]}>⚠ {t.chat.notSent}</Text>
        </Pressable>
      ) : null}
    </View>
  )
})

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({
    row: { marginBottom: 2 },
    bubble: {
      maxWidth: '78%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    bubbleMine: {
      backgroundColor: colors.dk,
      borderTopStartRadius: 4,
      borderTopEndRadius: 14,
      borderBottomStartRadius: 14,
      borderBottomEndRadius: 14,
      ...(dark ? null : shadow.ss),
    },
    bubbleTheirs: {
      backgroundColor: colors.card,
      borderTopStartRadius: 14,
      borderTopEndRadius: 4,
      borderBottomStartRadius: 14,
      borderBottomEndRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleImage: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 },
    failed: { opacity: 0.6 },
    text: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
    },
    caption: { paddingHorizontal: spacing.sm, paddingTop: 6 },
    textMine: { color: colors.white },
    textTheirs: { color: colors.text },
    voiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    voiceText: { flexShrink: 1 },
    voiceTitle: {
      fontFamily: fonts.bold,
      fontSize: 14,
      lineHeight: 20,
    },
    voiceHint: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      opacity: 0.85,
      textDecorationLine: 'underline',
    },
    pressed: { opacity: 0.7 },
    time: {
      fontFamily: fonts.regular,
      fontSize: 10,
      marginTop: 4,
    },
    timeMine: {
      color: colors.white,
      opacity: 0.7,
      textAlign: 'right',
    },
    timeTheirs: { color: colors.muted },
    timeImage: { paddingHorizontal: spacing.sm },
    retry: {
      marginTop: 4,
      paddingVertical: 2,
    },
    retryText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.red,
    },
  })
