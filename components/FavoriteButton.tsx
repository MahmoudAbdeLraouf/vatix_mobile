import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { authDelete, authPost } from '@/lib/auth'
import { loadFavoriteIds, markFavorite, peekFavorite, subscribeFavorites } from '@/lib/favorites-cache'
import { bumpEngagement } from '@/lib/rate-app-engagement'
import { colors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface FavoriteButtonProps {
  productId: number
  initialFaved?: boolean
  size?: number
  color?: string
  activeColor?: string
  style?: ViewStyle
  onChange?: (faved: boolean) => void
}

export function FavoriteButton({
  productId,
  initialFaved,
  size = 22,
  color,
  activeColor = colors.red,
  style,
  onChange,
}: FavoriteButtonProps) {
  const { colors: theme } = useTheme()
  const idleColor = color ?? theme.text
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [faved, setFaved] = useState<boolean>(
    () => initialFaved ?? (userId != null && !!peekFavorite(userId, productId)),
  )
  const [loading, setLoading] = useState<boolean>(false)
  // Ref guard is checked synchronously so a second tap in the same event-loop
  // tick can't race past a stale `loading` closure and fire a duplicate request.
  const inFlightRef = useRef<boolean>(false)

  useEffect(() => {
    if (typeof initialFaved === 'boolean') return
    if (userId == null) {
      setFaved(false)
      return
    }
    let cancelled = false
    // Peripheral heart icon: if the favorites list can't be fetched, leave
    // the icon in its initial state rather than surfacing an error on every
    // product card.
    void loadFavoriteIds(userId).then((ids) => {
      if (!cancelled && ids) setFaved(ids.has(productId))
    })
    // Hearts for the same product elsewhere (detail page, favorites list) write
    // through the shared cache; follow them unless this heart has a toggle in flight.
    const unsubscribe = subscribeFavorites(() => {
      if (inFlightRef.current) return
      const cached = peekFavorite(userId, productId)
      if (cached !== undefined) setFaved(cached)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [userId, productId, initialFaved])

  const toggle = async () => {
    if (!requireLogin()) return
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    const next = !faved
    setFaved(next)
    try {
      if (next) {
        await authPost(`/products/${productId}/favorite`, {})
        void bumpEngagement('favorite')
      } else {
        await authDelete(`/products/${productId}/favorite`)
      }
      markFavorite(productId, next)
      onChange?.(next)
    } catch {
      setFaved(!next)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={loading}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={faved ? t.removeFromFavorites : t.addToFavorites}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.7 }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={faved ? activeColor : idleColor} />
      ) : (
        <Ionicons
          name={faved ? 'heart' : 'heart-outline'}
          size={size}
          color={faved ? activeColor : idleColor}
        />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
