import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { markActionDismissed } from '@/lib/auth'
import { formatGiftDays } from '@/lib/promoGift'
import { Button } from '@/components/ui/Button'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface Props {
  visible?: boolean
  offer: { threshold: number; days: number; productCount: number }
  onClose: () => void
}

export function PromoGiftOfferDialog({ visible = true, offer, onClose }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const rowDir = ar ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const }) : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const { threshold, days, productCount } = offer
  const daysText = formatGiftDays(days, ar ? 'ar' : 'en')

  function handleDismiss() {
    if (busy) return
    setBusy(true)
    markActionDismissed('promo_gift_offer_dialog')
    onClose()
  }

  function handleGo() {
    if (busy) return
    setBusy(true)
    // The trigger already marked this display as seen when the dialog opened.
    onClose()
    router.push('/products/new' as never)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text style={[styles.sheetTitle, dirStyle]} numberOfLines={1}>
              {ar ? '🎁 هدية لمتجرك' : '🎁 A gift for your store'}
            </Text>
            <Pressable onPress={handleDismiss} hitSlop={8} accessibilityLabel={ar ? 'إغلاق' : 'Close'}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.description, dirStyle]}>
              {ar
                ? `أضف ${threshold} إعلانات وخد ترويج مجاني لمدة ${daysText} لإعلان تختاره، وإعلانك هيظهر قبل باقي الإعلانات.`
                : `Add ${threshold} listings and get a free ${daysText} promotion for a listing you choose; it will show before other listings.`}
            </Text>

            <View style={[styles.dots, rowDir]}>
              {Array.from({ length: threshold }, (_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i < productCount && styles.dotFilled]}
                />
              ))}
            </View>

            <Text style={[styles.progress, dirStyle]}>
              {ar
                ? `أضفت ${productCount} من ${threshold} إعلانات`
                : `You've added ${productCount} of ${threshold} listings`}
            </Text>

            <View style={[styles.actionsRow, rowDir]}>
              <View style={styles.actionCell}>
                <Button
                  label={ar ? 'بعدين' : 'Later'}
                  variant="outline"
                  size="lg"
                  onPress={handleDismiss}
                  disabled={busy}
                />
              </View>
              <View style={styles.actionCell}>
                <Button
                  label={ar ? 'أضف إعلان' : 'Add listing'}
                  variant="y"
                  size="lg"
                  onPress={handleGo}
                  disabled={busy}
                />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
    ...(dark ? null : shadow.sl),
  },
  sheetHeader: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
    marginEnd: spacing.md,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.dot,
  },
  dotFilled: {
    backgroundColor: '#F5B800',
    borderColor: '#F5B800',
  },
  progress: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  actionCell: {
    flex: 1,
  },
})
