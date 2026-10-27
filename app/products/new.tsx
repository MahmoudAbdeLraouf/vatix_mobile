import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { BottomTabBar } from '@/components/BottomTabBar'
import { useLocale } from '@/contexts/locale'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

// "Where are your products right now?" — shown on every add-product entry,
// for every user type, mirroring the website's /products/add chooser.
export default function NewProductChooserScreen() {
  const { t, locale } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    // Pin the Text's own direction so 'right' isn't double-flipped by the inherited RTL root.
    direction: 'ltr' as const,
  }
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  const options: { emoji: string; label: string; href: Href }[] = [
    { emoji: '📱', label: ip.optManual, href: '/products/add' },
    { emoji: '🟢', label: ip.optShopify, href: '/products/import/shopify' },
    { emoji: '🟠', label: ip.optEasyOrders, href: '/products/import/easyorders' },
    { emoji: '📊', label: ip.optExcel, href: '/products/import/excel' },
  ]

  return (
    <DashboardLayout title={t.addProduct} scroll={false} contentPadding={false} bottomBar={<BottomTabBar />}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, dirStyle]}>{ip.chooserTitle}</Text>
          <Text style={[styles.subtitle, dirStyle]}>{ip.chooserSubtitle}</Text>
        </View>

        {options.map((o) => (
          <Pressable
            key={String(o.href)}
            onPress={() => router.push(o.href)}
            style={({ pressed }) => [styles.card, rowDir, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={o.label}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.emoji}>{o.emoji}</Text>
            </View>
            <Text style={[styles.label, dirStyle]}>{o.label}</Text>
            <Ionicons name={ar ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.xs },
  title: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.heading },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.ss),
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.yellowBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.heading },
})
