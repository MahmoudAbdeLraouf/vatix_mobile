import React, { useState } from 'react'
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'
const WA_GREEN = '#25D366'

interface RevealPhoneProps {
  productId: number
  phone: string | null
  waLink: string | null
  showPhone: boolean
  style?: ViewStyle
}

export function RevealPhone({ productId, phone, waLink, showPhone, style }: RevealPhoneProps) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [revealed, setRevealed] = useState(false)

  const reveal = () => {
    setRevealed(true)
    fetch(`${BASE}/products/${productId}/phone-click`, { method: 'POST' }).catch(() => {})
  }

  const showPhoneLabel = ar ? 'عرض الرقم' : 'Show phone'
  const showWhatsappLabel = ar ? 'عرض واتساب' : 'Show WhatsApp'

  const hasPhoneBtn = showPhone && !!phone
  const hasWaBtn = !!waLink

  const handlePhonePress = () => {
    if (!revealed) return reveal()
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {})
  }

  const handleWaPress = () => {
    if (!revealed) return reveal()
    if (waLink) Linking.openURL(waLink).catch(() => {})
  }

  if (!hasPhoneBtn && !hasWaBtn) {
    return (
      <View style={[styles.emptyRow, style]}>
        <Text style={styles.emptyText}>
          {ar ? 'التواصل عبر الرسائل فقط' : 'Contact via messages only'}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.row, style]}>
      {hasPhoneBtn ? (
        <Pressable
          onPress={handlePhonePress}
          style={({ pressed }) => [styles.phoneBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="call" size={18} color={colors.dk} style={styles.iconStart} />
          <Text style={styles.phoneBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {revealed ? phone : showPhoneLabel}
          </Text>
        </Pressable>
      ) : null}

      {hasWaBtn ? (
        <Pressable
          onPress={handleWaPress}
          style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="logo-whatsapp" size={18} color={colors.white} style={styles.iconStart} />
          <Text style={styles.waBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {revealed ? 'WhatsApp' : showWhatsappLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  phoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.y,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    ...shadow.ss,
  },
  phoneBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
    flexShrink: 1,
  },
  waBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WA_GREEN,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    ...shadow.ss,
  },
  waBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
    flexShrink: 1,
  },
  iconStart: {
    marginEnd: 8,
  },
  emptyRow: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
  },
})
