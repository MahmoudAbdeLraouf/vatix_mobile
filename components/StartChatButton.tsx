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
import { authPost } from '@/lib/auth'
import { ConversationListItem } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

interface StartChatButtonProps {
  recipientId: number
  productId?: number
  label?: string
  iconOnly?: boolean
  style?: ViewStyle
}

export function StartChatButton({
  recipientId,
  productId,
  label,
  iconOnly,
  style,
}: StartChatButtonProps) {
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [loading, setLoading] = useState(false)

  const start = async () => {
    if (!requireLogin()) return
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
      style={({ pressed }) => [
        styles.btn,
        iconOnly && styles.btnIconOnly,
        style,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={iconOnly ? 22 : 18}
            color={colors.white}
            style={iconOnly ? undefined : styles.iconStart}
          />
          {!iconOnly && (
            <Text style={styles.label} numberOfLines={1}>
              {label ?? t.startChat}
            </Text>
          )}
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
    backgroundColor: colors.dk,
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
  iconStart: {
    marginEnd: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
})
