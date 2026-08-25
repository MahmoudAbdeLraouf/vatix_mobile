import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { authDelete, authFetch, authPost } from '@/lib/auth'
import { FavoriteProduct } from '@/lib/api'
import { bumpEngagement } from '@/lib/rate-app-engagement'
import { colors } from '@/constants/theme'

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
  color = colors.g800,
  activeColor = colors.red,
  style,
  onChange,
}: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const { requireLogin } = useLoginGate()
  const [faved, setFaved] = useState<boolean>(!!initialFaved)
  const [loading, setLoading] = useState<boolean>(false)
  // Ref guard is checked synchronously so a second tap in the same event-loop
  // tick can't race past a stale `loading` closure and fire a duplicate request.
  const inFlightRef = useRef<boolean>(false)

  useEffect(() => {
    if (typeof initialFaved === 'boolean') return
    if (!isAuthenticated) {
      setFaved(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const list = await authFetch<FavoriteProduct[]>('/products/favorites')
      if (cancelled) return
      if (Array.isArray(list)) {
        setFaved(list.some((f) => f.productId === productId))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, productId, initialFaved])

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
        <ActivityIndicator size="small" color={faved ? activeColor : color} />
      ) : (
        <Ionicons
          name={faved ? 'heart' : 'heart-outline'}
          size={size}
          color={faved ? activeColor : color}
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
