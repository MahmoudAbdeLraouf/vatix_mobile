import React from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import { fonts, radius } from '@/constants/theme'

const INSTAPAY_URL = 'https://ipn.eg/S/vatix/instapay/9BX0v3'

interface Props {
  amount: number | string
}

export function InstapayQrCard({ amount }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'

  return (
    <View style={styles.card}>
      <Text style={styles.header}>
        {ar ? 'اضغط الزر لفتح تطبيق إنستا باي وإتمام الدفع' : 'Tap the button to open InstaPay and complete payment'}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.openButton, pressed && styles.openButtonPressed]}
        onPress={() => Linking.openURL(INSTAPAY_URL).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={ar ? 'فتح تطبيق إنستا باي' : 'Open InstaPay app'}
      >
        <Text style={styles.openButtonText}>
          {ar ? 'فتح تطبيق إنستا باي' : 'Open InstaPay app'}
        </Text>
      </Pressable>

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
  openButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  openButtonPressed: {
    opacity: 0.85,
  },
  openButtonText: {
    color: '#7B2FBE',
    fontSize: 14,
    fontFamily: fonts.black,
    textAlign: 'center',
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
