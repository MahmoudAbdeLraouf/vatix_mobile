import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import type { PaymentContext } from '@/lib/payment'

type Source = 'wallet' | 'instapay' | 'card'

export default function PaymentSuccessScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'

  const params = useLocalSearchParams<{
    source?: Source
    context?: PaymentContext
  }>()

  const source = (params.source ?? 'card') as Source
  const context = (params.context ?? 'subscription') as PaymentContext
  const isPending = source === 'instapay'

  const title = isPending ? t.paymentPending : t.paymentSuccess
  const body = isPending ? t.paymentPendingBody : t.paymentSuccessBody

  const primaryLabel = contextPrimaryLabel(context, ar)
  const primaryTarget = contextPrimaryTarget(context)

  const goPrimary = () => router.replace(primaryTarget as any)
  const goHome = () => router.replace('/(tabs)/home')

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, isPending ? styles.iconWrapPending : styles.iconWrapSuccess]}>
            <Ionicons
              name={isPending ? 'time-outline' : 'checkmark-circle'}
              size={56}
              color={isPending ? colors.warning : colors.green}
            />
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.actions}>
            <Button label={primaryLabel} variant="cta" onPress={goPrimary} />
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

function contextPrimaryLabel(context: PaymentContext, ar: boolean): string {
  if (context === 'subscription') return ar ? 'إدارة الاشتراك' : 'Manage subscription'
  if (context === 'wallet_topup') return ar ? 'فتح المحفظة' : 'Open wallet'
  return ar ? 'باقات الترويج' : 'My promotions'
}

function contextPrimaryTarget(context: PaymentContext): string {
  if (context === 'subscription') return '/dashboard/subscription'
  if (context === 'wallet_topup') return '/dashboard/wallet'
  return '/dashboard/promotions'
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  container: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.sm,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSuccess: { backgroundColor: colors.gl },
  iconWrapPending: { backgroundColor: colors.ol },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.dk,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g700,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
})
