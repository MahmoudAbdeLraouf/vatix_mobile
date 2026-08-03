import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { authFetch } from '@/lib/auth'
import { colors, fonts, radius } from '@/constants/theme'

interface MessagesBellProps {
  color?: string
  size?: number
  style?: ViewStyle
}

export function MessagesBell({
  color = colors.dk,
  size = 22,
  style,
}: MessagesBellProps) {
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return
    }
    let cancelled = false
    const load = async () => {
      const res = await authFetch<{ count: number }>('/conversations/unread-count')
      if (cancelled || !res) return
      setUnread(res.count ?? 0)
    }
    load()
    const id = setInterval(load, 30_000)
    // Refresh immediately on foreground push arrival so the badge doesn't wait for the 30s poll.
    const sub = Notifications.addNotificationReceivedListener(() => {
      load()
    })
    return () => {
      cancelled = true
      clearInterval(id)
      sub.remove()
    }
  }, [isAuthenticated])

  const label = unread > 9 ? '9+' : String(unread)
  const wrapSize = { width: size, height: size }

  return (
    <Pressable
      onPress={() => {
        if (!requireLogin()) return
        router.push('/dashboard/messages')
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.messages}
      style={[styles.btn, style]}
    >
      <View style={[styles.iconWrap, wrapSize]}>
        <Ionicons name="chatbubble-outline" size={size} color={color} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wrap the glyph so the badge anchors to the icon, not the 36px hit area.
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    end: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
    lineHeight: 12,
  },
})
