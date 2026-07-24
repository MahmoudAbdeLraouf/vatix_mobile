import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import type { Notification } from '@/lib/api'
import { colors, fonts, radius } from '@/constants/theme'

export function NotificationBell() {
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return
    }
    let cancelled = false
    const load = async () => {
      const data = await authFetch<Notification[]>('/notifications')
      if (cancelled || !data) return
      setUnread(data.filter((n) => !n.isRead).length)
    }
    load()
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isAuthenticated])

  const label = unread > 9 ? '9+' : String(unread)

  return (
    <Pressable
      onPress={() => router.push('/dashboard/notifications')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.notifications}
      style={styles.btn}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.dk} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
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
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
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
