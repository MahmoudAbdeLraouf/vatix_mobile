import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { imgUrl, type Store } from '@/lib/api'
import { authDelete, authFetch } from '@/lib/auth'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

export default function FollowingScreen() {
  const { t, isRtl } = useLocale()
  const dirContainer = isRtl ? { direction: 'rtl' as const } : null
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const [stores, setStores] = useState<Store[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await authFetch<Store[]>('/user/follows/stores')
      setStores(data ?? [])
    } catch (e) {
      setError(e as Error)
      setStores([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleUnfollow(storeId: number) {
    setStores((prev) => (prev ? prev.filter((s) => s.id !== storeId) : prev))
    await authDelete(`/user/follows/stores/${storeId}`)
  }

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const count = stores?.length ?? 0

  return (
    <DashboardLayout title={t.following}>
      {/* Hero header */}
      <View style={[styles.hero, dirContainer]}>
        <View style={styles.heroIcon}>
          <Ionicons name="storefront" size={22} color={colors.seeAllText} />
        </View>
        <View style={styles.heroBody}>
          <Text style={[styles.heroTitle, textDirStyle]} numberOfLines={1}>
            {t.followingHeroTitle}
          </Text>
          <Text style={[styles.heroSubtitle, textDirStyle]} numberOfLines={1}>
            {t.followingHeroSubtitle}
          </Text>
        </View>
        {stores && stores.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{count}</Text>
          </View>
        )}
      </View>

      {stores === null && !error ? (
        <SkeletonGrid count={4} />
      ) : error ? (
        <ErrorState kind="network" onRetry={load} />
      ) : stores && stores.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="storefront-outline" size={30} color={colors.heading} />}
          title={t.followingEmptyTitle}
          subtitle={t.followingEmptySubtitle}
          actionLabel={t.browseStores}
          onAction={() => router.push('/(tabs)/stores')}
        />
      ) : (
        <View style={[styles.grid, dirContainer]}>
          {stores!.map((s) => {
            const sp = s.storeProfile
            const logoUrl = imgUrl(sp?.logo)
            const coverUrl = imgUrl(sp?.cover)
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/store/${s.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                {/* Cover */}
                <View style={styles.cover}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.coverImg} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="storefront-outline" size={26} color={colors.dot} />
                    </View>
                  )}

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation()
                      handleUnfollow(s.id)
                    }}
                    style={({ pressed }) => [
                      styles.unfollowBtn,
                      pressed && { transform: [{ scale: 0.92 }] },
                    ]}
                    hitSlop={8}
                    accessibilityLabel={t.unfollowStore}
                  >
                    <Ionicons name="heart-dislike" size={14} color={colors.red} />
                  </Pressable>
                </View>

                {/* Logo overlaps cover */}
                <View style={styles.logoWrap}>
                  <View style={styles.logoBox}>
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={styles.logoImg} />
                    ) : (
                      <Ionicons name="storefront" size={20} color={colors.dk} />
                    )}
                  </View>
                </View>

                <View style={styles.body}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, textDirStyle]}
                  >
                    {sp?.name ?? t.following}
                  </Text>
                  {sp?.description ? (
                    <Text
                      numberOfLines={2}
                      style={[styles.desc, textDirStyle]}
                    >
                      {sp.description}
                    </Text>
                  ) : (
                    <View style={styles.descSpacer} />
                  )}

                  <View style={styles.visitRow}>
                    <Text style={styles.visitText} numberOfLines={1}>
                      {t.visitStore}
                    </Text>
                    <Ionicons
                      name={isRtl ? 'chevron-back' : 'chevron-forward'}
                      size={14}
                      color={colors.heading}
                    />
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </DashboardLayout>
  )
}

const CARD_MIN = 200

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...(dark ? null : shadow.ss),
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.yellowBg,
    borderWidth: 2,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.heading,
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  countPill: {
    minWidth: 32,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.dk,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    flexGrow: 1,
    flexBasis: CARD_MIN,
    maxWidth: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...(dark ? null : shadow.ss),
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  cover: {
    height: 78,
    backgroundColor: colors.dk2,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.placeholder,
  },
  unfollowBtn: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.redBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...(dark ? null : shadow.ss),
  },

  logoWrap: {
    height: 0,
    alignItems: 'center',
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginTop: -26,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.ss,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  body: {
    paddingTop: spacing.md + 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 4,
    alignItems: 'stretch',
  },
  name: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: colors.heading,
    textAlign: 'center',
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
    textAlign: 'center',
    minHeight: 30,
  },
  descSpacer: {
    minHeight: 30,
  },

  visitRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  visitText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.heading,
  },
})
