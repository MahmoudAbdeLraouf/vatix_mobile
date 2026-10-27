import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { useLocale } from '@/contexts/locale'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import type { PaymentContext } from '@/lib/payment'

export default function PaymentFailedScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const params = useLocalSearchParams<{
    context?: PaymentContext
    reason?: string
  }>()

  const reason = params.reason?.trim()
  const body = reason
    ? reason
    : ar
      ? 'لم تكتمل عملية الدفع، حاول مرة أخرى.'
      : 'Payment did not complete. Please try again.'

  const goRetry = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/checkout')
    }
  }
  const goHome = () => router.replace('/(tabs)/home')

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="close-circle" size={56} color={colors.red} />
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {t.paymentFailed}
          </Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.actions}>
            <Button
              label={ar ? 'حاول مرة أخرى' : 'Try again'}
              variant="cta"
              onPress={goRetry}
            />
            <Button
              label={ar ? 'العودة إلى الرئيسية' : 'Back to home'}
              variant="ghost"
              onPress={goHome}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.sm),
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redBg,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.heading,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
})
