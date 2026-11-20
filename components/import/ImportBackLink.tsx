import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { fonts, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

// "Back to My Ads" link at the top of each import screen (bulk import is opened from My Ads).
export function ImportBackLink() {
  const { t, locale } = useLocale()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const ar = locale === 'ar'
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard/my-ads'))}
      hitSlop={8}
      style={({ pressed }) => [styles.link, rowDir, pressed && { opacity: 0.7 }]}
      accessibilityRole="link"
    >
      <Ionicons name={ar ? 'arrow-forward' : 'arrow-back'} size={16} color={colors.muted} />
      <Text style={styles.text}>{t.importProducts.backToMyAds}</Text>
    </Pressable>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'stretch' },
  text: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted },
})
