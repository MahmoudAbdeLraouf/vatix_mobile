import React, { useMemo } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { MAX_CAPTION_LENGTH, MAX_IMAGES_PER_MESSAGE } from '@/lib/chat/images'
import type { ImageTrayState, TrayItem } from './useImageTray'

const THUMB = 64

type Props = {
  tray: ImageTrayState
  onSend: () => void
}

function Thumb({
  item,
  onRemove,
  onRetry,
  styles,
}: {
  item: TrayItem
  onRemove: () => void
  onRetry: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  const { t } = useLocale()
  return (
    <View style={styles.thumb}>
      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={100} />
      {item.status === 'uploading' ? (
        <View
          style={[styles.overlay, styles.overlayBusy]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: item.progress }}
        >
          <Text style={styles.pct}>{item.progress}%</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${item.progress}%` }]} />
          </View>
        </View>
      ) : null}
      {item.status === 'error' ? (
        <View style={[styles.overlay, styles.overlayError]}>
          {item.error === 'tooLarge' ? (
            <Text style={styles.tooLarge} accessibilityLabel={t.chat.tooLarge}>
              15MB+
            </Text>
          ) : (
            <Pressable
              onPress={onRetry}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.retry}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={18} color="#E53E3E" />
            </Pressable>
          )}
        </View>
      ) : null}
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.chat.removePhoto}
        style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={13} color="#FFFFFF" />
      </Pressable>
    </View>
  )
}

/** Pending images above the keyboard: per-image upload progress, remove / retry, caption and send. */
export function ImageTray({ tray, onSend }: Props) {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const count = tray.items.length
  const canSend = tray.ready

  const notice =
    tray.notice === 'tooManyImages'
      ? t.chat.tooManyImages
      : tray.items.some((it) => it.error === 'tooLarge')
        ? t.chat.tooLarge
        : tray.items.some((it) => it.error === 'failed')
          ? t.chat.uploadFailed
          : null

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.count, dirStyle]}>{t.chat.photosSelected.replace('{n}', String(count))}</Text>
        <Pressable
          onPress={tray.discard}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.cancel}
          style={({ pressed }) => [styles.discard, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={14} color={colors.muted} />
          <Text style={styles.discardText}>{t.cancel}</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbs}
        keyboardShouldPersistTaps="handled"
      >
        {tray.items.map((item) => (
          <Thumb
            key={item.key}
            item={item}
            styles={styles}
            onRemove={() => tray.remove(item.key)}
            onRetry={() => tray.retry(item.key)}
          />
        ))}
        {count < MAX_IMAGES_PER_MESSAGE ? (
          <Pressable
            onPress={tray.openPicker}
            accessibilityRole="button"
            accessibilityLabel={t.chat.attach}
            style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color={colors.muted} />
          </Pressable>
        ) : null}
      </ScrollView>

      {notice ? (
        <Text style={[styles.notice, dirStyle]} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.pill}>
          <TextInput
            style={[styles.input, dirStyle]}
            value={tray.caption}
            onChangeText={tray.setCaption}
            placeholder={t.chat.addCaption}
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={MAX_CAPTION_LENGTH}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.sendBtn, !canSend && styles.sendBtnDisabled, pressed && canSend && styles.sendBtnPressed]}
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t.send}
          accessibilityState={{ disabled: !canSend }}
        >
          <Ionicons
            name="send"
            size={20}
            color={canSend ? colors.dk : colors.subtle}
            style={ar ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </Pressable>
      </View>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    count: {
      flexShrink: 1,
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.muted,
    },
    discard: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    discardText: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
    thumbs: { gap: spacing.sm, paddingBottom: 4 },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.placeholder,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlayBusy: { backgroundColor: 'rgba(6,20,45,0.45)' },
    overlayError: { backgroundColor: 'rgba(160,20,20,0.55)' },
    pct: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },
    barTrack: {
      position: 'absolute',
      bottom: 6,
      start: 6,
      end: 6,
      height: 3,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.35)',
      overflow: 'hidden',
    },
    barFill: { height: 3, backgroundColor: colors.y },
    tooLarge: { fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF', writingDirection: 'ltr' },
    retryBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBtn: {
      position: 'absolute',
      top: 3,
      end: 3,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
      width: THUMB,
      height: THUMB,
      borderRadius: 10,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notice: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.red,
      marginTop: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
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
      maxHeight: 120,
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
    sendBtnPressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
    pressed: { opacity: 0.7 },
  })
