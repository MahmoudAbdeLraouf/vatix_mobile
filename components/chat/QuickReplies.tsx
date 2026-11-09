import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import type { QuickReply } from '@/lib/chat/types'

/** Buyer quick-reply chips shown above the composer on an empty product thread; the first is highlighted. */
export function QuickReplies({ items, onPick }: { items: QuickReply[]; onPick: (text: string) => void }) {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  if (items.length === 0) return null
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      accessibilityLabel={t.chat.quickReplies}
    >
      {items.map((q, i) => {
        const label = ar ? q.ar : q.en
        return (
          <Pressable
            key={`${i}-${label}`}
            onPress={() => onPick(label)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, i === 0 && styles.chipFirst, pressed && styles.pressed]}
          >
            <Text style={[styles.chipText, i === 0 && styles.chipTextFirst]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipFirst: {
      borderColor: colors.y,
      backgroundColor: colors.yellowBg,
    },
    pressed: { opacity: 0.75 },
    chipText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: colors.text,
    },
    chipTextFirst: { color: colors.heading },
  })
