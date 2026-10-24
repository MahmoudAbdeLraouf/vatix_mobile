import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, spacing } from '@/constants/theme'

const WA_GREEN = '#25D366'

export function OtpChannelHint() {
  const { t, isRtl } = useLocale()
  const dirStyle = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  return (
    <View style={styles.box}>
      <Ionicons name="logo-whatsapp" size={20} color={WA_GREEN} />
      <Text style={[styles.text, dirStyle]}>{t.otpViaWhatsapp}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: '#EDFBF2',
    borderColor: '#B7EBCB',
  },
  text: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.g700,
  },
})
