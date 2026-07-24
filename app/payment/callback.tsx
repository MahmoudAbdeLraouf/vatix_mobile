import React, { useEffect, useRef } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'

import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import {
  finalizePaymentSuccess,
  pollPaymobStatus,
  verifyPaymobRedirect,
  type PaymentContext,
} from '@/lib/payment'

export default function PaymobCallbackScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const params = useLocalSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void (async () => {
      const rawId = params.paymentId
      const paymentId = rawId ? Number(rawId) : NaN
      const context = (params.context ?? 'subscription') as PaymentContext

      if (!Number.isFinite(paymentId) || paymentId <= 0) {
        router.replace({
          pathname: '/payment/failed',
          params: { context },
        })
        return
      }

      const redirectParams: Record<string, string> = {}
      for (const [k, v] of Object.entries(params)) {
        if (k === 'paymentId' || k === 'context') continue
        if (typeof v === 'string' && v.length > 0) redirectParams[k] = v
      }

      if (Object.keys(redirectParams).length > 0) {
        await verifyPaymobRedirect(paymentId, redirectParams)
      }

      const res = await pollPaymobStatus(paymentId)

      if (res?.status === 'success') {
        await finalizePaymentSuccess()
        router.replace({
          pathname: '/payment/success',
          params: { source: 'card', context },
        })
        return
      }

      if (res?.status === 'failed') {
        router.replace({
          pathname: '/payment/failed',
          params: {
            context,
            reason: ar
              ? 'رفض المصدر عملية الدفع.'
              : 'The payment was rejected by the gateway.',
          },
        })
        return
      }

      router.replace({
        pathname: '/payment/success',
        params: { source: 'instapay', context },
      })
    })()
  }, [ar, params])

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.y} />
          <Text style={styles.title}>
            {ar ? 'جاري التحقق من الدفع…' : 'Verifying your payment…'}
          </Text>
          <Text style={styles.body}>
            {ar
              ? 'من فضلك انتظر قليلاً حتى نؤكد عملية الدفع.'
              : 'Please wait a moment while we confirm your payment.'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
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
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.dk,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g700,
    textAlign: 'center',
    lineHeight: 22,
  },
})
