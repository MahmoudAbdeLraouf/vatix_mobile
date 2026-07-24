import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authPost } from '@/lib/auth'
import { ConversationListItem } from '@/lib/api'
import { colors, fonts, radius, spacing } from '@/constants/theme'

interface StartChatButtonProps {
  recipientId: number
  productId?: number
  label?: string
  style?: ViewStyle
}

export function StartChatButton({ recipientId, productId, label, style }: StartChatButtonProps) {
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  const start = async () => {
    if (!isAuthenticated) {
      Alert.alert(t.loginRequired, t.loginToAccess, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.login,
          onPress: () =>
            router.push(
              pathname && pathname.startsWith('/') && !pathname.startsWith('/(auth)')
                ? { pathname: '/(auth)/login', params: { redirect: pathname } }
                : '/(auth)/login',
            ),
        },
      ])
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const conv = await authPost<ConversationListItem>('/conversations', {
        recipientId,
        productId,
      })
      router.push(`/dashboard/messages/${conv.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      Alert.alert(t.startChat, msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Pressable
      onPress={start}
      disabled={loading}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.85 }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.dk} />
      ) : (
        <>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={colors.dk}
            style={styles.iconStart}
          />
          <Text style={styles.label} numberOfLines={1}>
            {label ?? t.startChat}
          </Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.dk,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  iconStart: {
    marginEnd: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
})
