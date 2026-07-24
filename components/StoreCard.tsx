import React from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Store, imgUrl } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const COVER_H = 80
const LOGO_SIZE = 44
const LOGO_HALF = LOGO_SIZE / 2

interface StoreCardProps {
  store: Store
  style?: ViewStyle
}

export function StoreCard({ store, style }: StoreCardProps) {
  if (!store.storeProfile) return null
  // Logo is 44px, cover is 80px tall in a full-width card — request modest
  // widths so the resize endpoint returns thumbnails, not originals.
  const logo = imgUrl(store.storeProfile.logo, { w: 160 })
  const cover = imgUrl(store.storeProfile.cover, { w: 600 })
  const name = store.storeProfile.name

  return (
    <Pressable
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/store/${store.id}`)}
    >
      {/* Cover */}
      <View style={styles.coverWrap}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={`sc-${store.id}`}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={26} color="rgba(255,255,255,0.25)" />
          </View>
        )}
        {/* Subtle bottom fade */}
        <View style={styles.coverFade} />
        {store.type === 'store_plus' ? (
          <View style={styles.plusBadge}>
            <Text style={styles.plusBadgeText}>⭐ Plus</Text>
          </View>
        ) : null}
      </View>

      {/* Logo overlapping cover */}
      <View style={styles.logoRow}>
        <View style={styles.logoRing}>
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={styles.logoImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              recyclingKey={`scl-${store.id}`}
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Name + Description */}
      <View style={styles.nameWrap}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {store.storeProfile.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {store.storeProfile.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },

  coverWrap: {
    height: COVER_H,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    backgroundColor: colors.dk2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  plusBadge: {
    position: 'absolute',
    top: 8,
    end: 8,
    backgroundColor: 'rgba(6,43,91,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  plusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white,
    letterSpacing: 0.3,
  },

  logoRow: {
    alignItems: 'center',
    marginTop: -LOGO_HALF,
  },
  logoRing: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_HALF,
    borderWidth: 2.5,
    borderColor: colors.white,
    overflow: 'hidden',
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    backgroundColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.y,
  },

  nameWrap: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g800,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.g500,
    textAlign: 'center',
    lineHeight: 14,
  },
})
