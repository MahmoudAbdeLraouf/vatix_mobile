import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useLocale } from '@/contexts/locale'
import { fonts, radius } from '@/constants/theme'

interface Props {
  amount: number | string
  walletNumber: string
  walletName?: string | null
}

export function MobileWalletCard({ amount, walletNumber, walletName }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(walletNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore clipboard errors */
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.header}>
        {ar ? 'حوّل المبلغ إلى محفظة الموبايل التالية' : 'Transfer to the mobile wallet below'}
      </Text>

      <View style={styles.walletFrame}>
        <Text style={styles.walletLabel}>
          {ar ? 'رقم المحفظة' : 'Wallet number'}
        </Text>
        <Text style={styles.walletNumber}>{walletNumber}</Text>
        {walletName ? <Text style={styles.walletName}>{walletName}</Text> : null}
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [
            styles.copyButton,
            copied && styles.copyButtonCopied,
            pressed && styles.copyButtonPressed,
          ]}
        >
          <Text style={styles.copyButtonText}>
            {copied
              ? (ar ? 'تم النسخ ✓' : 'Copied ✓')
              : (ar ? 'نسخ الرقم' : 'Copy number')}
          </Text>
        </Pressable>
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
            ? '١. افتح تطبيق محفظة الموبايل وحوّل المبلغ إلى الرقم أعلاه\n٢. ارفع صورة إيصال التحويل بالأسفل'
            : '1. Open your mobile wallet app and transfer the amount to the number above\n2. Upload the transfer receipt below'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 18,
    alignItems: 'center',
  },
  header: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  walletFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
    fontFamily: fonts.bold,
  },
  walletNumber: {
    fontSize: 22,
    color: '#065f46',
    fontFamily: fonts.black,
    letterSpacing: 1,
    writingDirection: 'ltr',
    marginBottom: 10,
  },
  walletName: {
    fontSize: 12,
    color: '#4b5563',
    fontFamily: fonts.regular,
    marginBottom: 10,
  },
  copyButton: {
    backgroundColor: '#10b981',
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  copyButtonCopied: {
    backgroundColor: '#065f46',
  },
  copyButtonPressed: {
    opacity: 0.85,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fonts.bold,
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
    color: 'rgba(255,255,255,0.8)',
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
