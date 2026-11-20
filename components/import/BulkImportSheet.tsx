import React, { useMemo } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

// Bulk-import source picker opened from My Ads — Add Product goes straight to
// the manual form, so Shopify / EasyOrders / Excel live here (same as the website).
export function BulkImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, locale } = useLocale()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    direction: 'ltr' as const,
  }
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  const options: { emoji: string; label: string; href: Href }[] = [
    { emoji: '🟢', label: ip.optShopify, href: '/products/import/shopify' },
    { emoji: '🟠', label: ip.optEasyOrders, href: '/products/import/easyorders' },
    { emoji: '📊', label: ip.optExcel, href: '/products/import/excel' },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grab} />
          <View style={styles.body}>
            <View style={[styles.head, rowDir]}>
              <Text style={[styles.title, dirStyle]}>{ip.bulkImportTitle}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t.close}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={[styles.subtitle, dirStyle]}>{ip.chooserTitle}</Text>

            {options.map((o) => (
              <Pressable
                key={String(o.href)}
                onPress={() => {
                  onClose()
                  router.push(o.href)
                }}
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
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sl,
  },
  grab: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: 8,
  },
  body: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: fonts.black, fontSize: 17, color: colors.heading },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
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
