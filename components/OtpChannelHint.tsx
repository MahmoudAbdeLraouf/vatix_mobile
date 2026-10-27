import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const WA_GREEN = '#25D366'

export function OtpChannelHint() {
  const { t, isRtl } = useLocale()
  const styles = themedStyles[useTheme().mode]
  const dirStyle = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  return (
    <View style={styles.box}>
      <Ionicons name="logo-whatsapp" size={20} color={WA_GREEN} />
      <Text style={[styles.text, dirStyle]}>{t.otpViaWhatsapp}</Text>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark = false) => StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: dark ? colors.greenBg : '#EDFBF2',
    borderColor: dark ? 'rgba(37,211,102,0.35)' : '#B7EBCB',
  },
  text: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }
