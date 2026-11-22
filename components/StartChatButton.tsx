import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { authErrorMessage, authPost } from '@/lib/auth'
import { ConversationListItem } from '@/lib/api'
import { track } from '@/lib/analytics'
import { bumpEngagement } from '@/lib/rate-app-engagement'
import { colors, darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface StartChatButtonProps {
  recipientId: number
  productId?: number
  label?: string
  iconOnly?: boolean
  // 'sm': compact pill for the contact row inside product cards.
  size?: 'md' | 'sm'
  style?: ViewStyle
  // Outline variants (white bg) need a dark icon instead of the default white.
  iconColor?: string
  // Runs after the conversation is created.
  onStarted?: () => void
}

export function StartChatButton({
  recipientId,
  productId,
  label,
  iconOnly,
  size = 'md',
  style,
  iconColor = colors.white,
  onStarted,
}: StartChatButtonProps) {
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [loading, setLoading] = useState(false)
  const styles = themedStyles[useTheme().mode]
  const sm = size === 'sm'

  const start = async () => {
    if (!requireLogin()) return
    if (loading) return
    setLoading(true)
    try {
      const conv = await authPost<ConversationListItem>('/conversations', {
        recipientId,
        productId,
      })
      if (productId) {
        void track({
          name: 'contact_seller',
          params: { product_id: productId, channel: 'chat' },
        })
      }
      void bumpEngagement('inquiry')
      onStarted?.()
      router.push(`/dashboard/messages/${conv.id}`)
    } catch (e: unknown) {
      Alert.alert(t.startChat, authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Pressable
      onPress={start}
      disabled={loading}
      style={({ pressed }) => [
        styles.btn,
        iconOnly && styles.btnIconOnly,
        sm && styles.btnSm,
        style,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={sm ? 16 : iconOnly ? 22 : 18}
            color={iconColor}
            style={iconOnly ? undefined : sm ? styles.iconStartSm : styles.iconStart}
          />
          {!iconOnly && (
            <Text style={[styles.label, sm && styles.labelSm]} numberOfLines={1}>
              {label ?? t.startChat}
            </Text>
          )}
        </>
      )}
    </Pressable>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fab,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    ...shadow.ss,
  },
  btnIconOnly: {
    width: 56,
    paddingHorizontal: 0,
  },
  // Sizing comes from the caller (flex:1 in the card row), so drop the fixed width.
  btnSm: {
    width: undefined,
    minHeight: 34,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    shadowOpacity: 0,
    elevation: 0,
  },
  iconStart: {
    marginEnd: 8,
  },
  iconStartSm: {
    marginEnd: 5,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
  labelSm: {
    fontSize: 12,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
