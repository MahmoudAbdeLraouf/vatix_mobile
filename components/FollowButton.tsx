import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { authDelete, authFetch, authPost } from '@/lib/auth'
import { colors, fonts, radius, spacing } from '@/constants/theme'

interface FollowButtonProps {
  storeId: number
  initialFollowing?: boolean
  showLabel?: boolean
  style?: ViewStyle
  onChange?: (following: boolean) => void
}

export function FollowButton({
  storeId,
  initialFollowing,
  showLabel = true,
  style,
  onChange,
}: FollowButtonProps) {
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [following, setFollowing] = useState<boolean>(!!initialFollowing)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (typeof initialFollowing === 'boolean') return
    if (!isAuthenticated) {
      setFollowing(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await authFetch<{ following: boolean }>(
        `/user/follows/stores/${storeId}/check`,
      )
      if (cancelled) return
      if (res) setFollowing(res.following)
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, storeId, initialFollowing])

  const toggle = async () => {
    if (!requireLogin()) return
    if (loading) return
    setLoading(true)
    const next = !following
    setFollowing(next)
    try {
      if (next) {
        await authPost(`/user/follows/stores/${storeId}`, {})
      } else {
        await authDelete(`/user/follows/stores/${storeId}`)
      }
      onChange?.(next)
    } catch {
      setFollowing(!next)
    } finally {
      setLoading(false)
    }
  }

  const tint = following ? colors.dk : colors.white

  return (
    <Pressable
      onPress={toggle}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={following ? t.unfollowStore : t.followStore}
      style={({ pressed }) => [
        styles.pill,
        following && styles.pillActive,
        style,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          <Ionicons
            name={following ? 'heart' : 'heart-outline'}
            size={14}
            color={tint}
          />
          {showLabel && (
            <Text style={[styles.label, { color: tint }]}>
              {following ? t.unfollowStore : t.followStore}
            </Text>
          )}
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillActive: {
    backgroundColor: colors.y,
    borderColor: colors.y,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
})
