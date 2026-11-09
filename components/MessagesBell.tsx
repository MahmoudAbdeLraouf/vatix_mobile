import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { authFetch } from '@/lib/auth'
import { useChatEvents, useFallbackPoll } from '@/lib/chatSocket'
import { fonts, radius, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface MessagesBellProps {
  color?: string
  size?: number
  style?: ViewStyle
}

export function MessagesBell({
  color,
  size = 22,
  style,
}: MessagesBellProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [unread, setUnread] = useState(0)

  // Peripheral badge: silently swallow transient failures so a flaky poll
  // doesn't crash the topbar or spam the console.
  const load = useCallback(async () => {
    const res = await authFetch<{ count: number }>('/conversations/unread-count').catch(() => null)
    if (!res) return
    setUnread(res.count ?? 0)
  }, [])

  // Initial value, and refresh immediately on foreground push arrival.
  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return
    }
    void load()
    const sub = Notifications.addNotificationReceivedListener(() => { void load() })
    return () => sub.remove()
  }, [isAuthenticated, load])

  // Live updates: the server pushes the new count (it does not emit one on connect, hence the load above).
  useChatEvents({
    'unread:count': (p) => { if (isAuthenticated) setUnread(p.count ?? 0) },
  })

  // Socket down for more than 10 s: fall back to the old 30 s poll (plus a catch-up on reconnect / foreground).
  useFallbackPoll(() => { if (isAuthenticated) void load() }, 30_000)

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
        <Ionicons name="chatbubble-outline" size={size} color={color ?? colors.heading} />
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
    borderColor: colors.card,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
    lineHeight: 12,
  },
})
