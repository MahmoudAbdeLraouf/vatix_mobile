import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocale } from '@/contexts/locale'
import { fonts, radius } from '@/constants/theme'

interface Props {
  amount: number | string
}

const QR_SOURCE = require('@/assets/instapay-qr.jpeg')

export function InstapayQrCard({ amount }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'

  return (
    <View style={styles.card}>
      <Text style={styles.header}>
        {ar ? 'امسح الكود لفتح تطبيق InstaPay والدفع' : 'Scan to open InstaPay and pay'}
      </Text>

      <View style={styles.qrFrame}>
        <Image
          source={QR_SOURCE}
          style={styles.qrImage}
          contentFit="contain"
          transition={0}
          accessibilityLabel="InstaPay QR"
        />
      </View>

      <View style={styles.amountPill}>
        <Text style={styles.amountLabel}>{ar ? 'المبلغ: ' : 'Amount: '}</Text>
        <Text style={styles.amountValue}>
          {amount} {ar ? 'ج.م' : 'EGP'}
        </Text>
      </View>

      <View style={styles.instructions}>
        <Text style={[styles.instructionsText, ar ? styles.textRtl : styles.textLtr]}>
          {ar
            ? '١. افتح الكاميرا وامسح الكود\n٢. سيفتح تطبيق InstaPay تلقائيًا، أدخل المبلغ\n٣. أكمل الدفع، ثم ارفع صورة الإيصال بالأسفل'
            : '1. Open your camera and scan the QR\n2. InstaPay will open automatically — enter the amount\n3. Complete payment, then upload the receipt below'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#7B2FBE',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 18,
    alignItems: 'center',
  },
  header: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 12,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  qrImage: {
    width: 220,
    height: 235,
  },
  amountPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amountLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.regular,
  },
  amountValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: fonts.black,
  },
  instructions: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  instructionsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 22,
    fontFamily: fonts.regular,
  },
  textRtl: {
    textAlign: 'right',
  },
  textLtr: {
    textAlign: 'left',
  },
})
