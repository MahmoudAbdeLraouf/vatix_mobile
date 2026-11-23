// Summary of the client's store application (dashboard + every spot that would
// otherwise pitch "convert to a store"). Full status and the edit form live on
// /dashboard/store-application. Pending without a live product points at Add Product.
import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { REASON_EN, type MyStoreApplication } from '@/lib/storeApplication'

function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const } : null,
    colDir: ar ? { direction: 'rtl' as const } : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
  }
}

export function StoreApplicationStatusCard({
  app,
  onNavigate,
  hideAddProduct = false,
  style,
}: {
  app: MyStoreApplication
  /** Runs before navigating away, e.g. to close the sheet hosting the card. */
  onNavigate?: () => void
  /** On the add-product screen itself the "add product" CTA would be a no-op. */
  hideAddProduct?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors, isDark } = useTheme()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const needsProduct = app.status === 'pending' && (app.activeProductCount ?? 1) < (app.minProducts ?? 1)
  const individual = app.status === 'rejected' && (app.reasonCode === 'individual_seller' || app.reasonCode === 'meant_to_add_product')
  const reason = app.reasonCode
    ? ar
      ? (app.reasonLabel ?? '')
      : (REASON_EN[app.reasonCode] ?? app.reasonLabel ?? '')
    : ''
  const go = (path: string) => {
    onNavigate?.()
    router.push(path as never)
  }
  const openApplication = () => go('/dashboard/store-application')

  const v = needsProduct
    ? {
        icon: '📦',
        title: ar ? 'طلب متجرك مستني أول منتج' : 'Your store application needs a product',
        sub: ar
          ? 'أضف منتج واحد على الأقل علشان نقدر نوافق على متجرك.'
          : 'Add at least one live product so we can approve your store.',
        cta: hideAddProduct ? (ar ? 'تفاصيل الطلب' : 'View') : ar ? 'أضف منتج' : 'Add product',
        onPress: hideAddProduct ? openApplication : () => go('/products/add'),
      }
    : {
        pending: {
          icon: '⏳',
          title: ar ? 'طلب متجرك قيد المراجعة' : 'Your store application is under review',
          sub: ar
            ? `بنراجع الطلبات عادةً خلال ${app.reviewSlaHours} ساعة وهنبلغك أول ما نخلص.`
            : `We usually review within ${app.reviewSlaHours} hours and will notify you.`,
          cta: ar ? 'تفاصيل الطلب' : 'View',
        },
        needs_changes: {
          icon: '✏️',
          title: ar ? 'طلب متجرك يحتاج تعديل بسيط' : 'Your store application needs changes',
          sub: reason || (ar ? 'عدّل البيانات وأعد الإرسال في أي وقت.' : 'Update the details and resubmit any time.'),
          cta: ar ? 'عدّل الطلب' : 'Edit',
        },
        rejected: individual
          ? {
              icon: '👤',
              title: ar ? 'حسابك هيفضل حساب عادي' : 'Your account stays a regular account',
              sub: ar
                ? 'تقدر تكمل نشر منتجاتك كبائع فردي. ولو عندك متجر فعلي أعد التقديم في أي وقت.'
                : 'Keep listing as an individual seller, or resubmit any time if you run a real store.',
              cta: ar ? 'التفاصيل' : 'Details',
            }
          : {
              icon: '❌',
              title: ar ? 'لم تتم الموافقة على طلب متجرك' : 'Your store application was not approved',
              sub: reason || (ar ? 'تقدر تعدّل البيانات وتعيد التقديم في أي وقت.' : 'You can update the details and resubmit any time.'),
              cta: ar ? 'أعد التقديم' : 'Resubmit',
            },
        approved: {
          icon: '🎉',
          title: ar ? 'تمت الموافقة على متجرك!' : 'Your store is approved!',
          sub: ar ? 'متجرك جاهز. ابدأ بتجهيز صفحتك.' : 'Your store is live. Set up your page.',
          cta: ar ? 'افتح' : 'Open',
        },
      }[app.status]
  if (!v) return null
  const onPress = 'onPress' in v ? v.onPress : openApplication

  return (
    <Pressable
      onPress={openApplication}
      accessibilityRole="button"
      style={({ pressed }) => [styles.banner, rowDir, style, pressed && { opacity: 0.9 }]}
    >
      <Text style={{ fontSize: 22 }}>{v.icon}</Text>
      <View style={[styles.text, colDir]}>
        <Text style={[styles.title, dirStyle]}>{v.title}</Text>
        {!!v.sub && (
          <Text style={[styles.sub, dirStyle]} numberOfLines={3}>
            {v.sub}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.ctaText}>{v.cta}</Text>
      </Pressable>
    </Pressable>
  )
}

function makeStyles(c: ThemeColors, _isDark: boolean) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: c.yellowBg,
      borderWidth: 1.5,
      borderColor: c.y,
    },
    text: { flex: 1, gap: 4 },
    title: { fontFamily: fonts.extraBold, fontSize: 15, color: c.heading },
    sub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: c.heading, opacity: 0.8 },
    cta: { backgroundColor: c.fab, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
    ctaText: { fontFamily: fonts.extraBold, fontSize: 13, color: c.y },
  })
}
