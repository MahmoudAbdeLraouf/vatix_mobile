import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { imgUrl, localeName, type FavoriteProduct } from '@/lib/api'
import { authDelete, authFetch } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

export default function FavoritesScreen() {
  const { t, locale, isRtl } = useLocale()
  const insets = useSafeAreaInsets()

  const [favs, setFavs] = useState<FavoriteProduct[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // per-favorite animation value (opacity + scale) keyed by favorite id
  const anims = useRef<Map<number, Animated.Value>>(new Map())
  const getAnim = (id: number) => {
    let a = anims.current.get(id)
    if (!a) {
      a = new Animated.Value(1)
      anims.current.set(id, a)
    }
    return a
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await authFetch<FavoriteProduct[]>('/products/favorites')
      setFavs(data ?? [])
    } catch (e) {
      setError(e as Error)
      setFavs([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await authFetch<FavoriteProduct[]>('/products/favorites')
      setFavs(data ?? [])
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  function handleRemove(favId: number, productId: number) {
    const anim = getAnim(favId)
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return
      setFavs((prev) => (prev ? prev.filter((f) => f.productId !== productId) : prev))
      anims.current.delete(favId)
    })
    // fire-and-forget; UI is optimistic
    authDelete(`/products/${productId}/favorite`).catch(() => {})
  }

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const count = favs?.length ?? 0

  return (
    <DashboardLayout title={t.favorites} scroll={false} contentPadding={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.y}
            colors={[colors.y]}
          />
        }
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="heart" size={22} color={colors.red} />
          </View>
          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, textDirStyle]} numberOfLines={1}>
              {t.favoritesHeroTitle}
            </Text>
            <Text style={[styles.heroSubtitle, textDirStyle]} numberOfLines={1}>
              {t.favoritesHeroSubtitle}
            </Text>
          </View>
          {favs && favs.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{count}</Text>
            </View>
          )}
        </View>

        {favs === null && !error ? (
          <SkeletonGrid count={4} />
        ) : error ? (
          <ErrorState kind="network" onRetry={load} />
        ) : favs && favs.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="heart-outline" size={30} color={colors.red} />}
            title={t.favoritesEmptyTitle}
            subtitle={t.favoritesEmptySubtitle}
            actionLabel={t.browseProducts}
            onAction={() => router.push('/(tabs)/products')}
          />
        ) : (
          <View style={styles.grid}>
            {favs!.map((f) => {
              const p = f.product
              const thumb = imgUrl(p.images?.[0]?.url)
              const categoryName = p.category
                ? localeName(p.category.translations, locale)
                : ''
              const anim = getAnim(f.id)
              return (
                <Animated.View
                  key={f.id}
                  style={[
                    styles.cardWrap,
                    {
                      opacity: anim,
                      transform: [
                        {
                          scale: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => router.push(`/products/${p.id}`)}
                    style={({ pressed }) => [
                      styles.card,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.thumbWrap}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.thumb} />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons name="image-outline" size={28} color={colors.g300} />
                        </View>
                      )}

                      {p.promotedUntil && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{t.featured}</Text>
                        </View>
                      )}

                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation()
                          handleRemove(f.id, f.productId)
                        }}
                        style={({ pressed }) => [
                          styles.heartBtn,
                          pressed && { transform: [{ scale: 0.92 }] },
                        ]}
                        hitSlop={8}
                        accessibilityLabel={t.removeFromFavorites}
                      >
                        <Ionicons name="heart" size={16} color={colors.red} />
                      </Pressable>
                    </View>

                    <View style={styles.body}>
                      {categoryName ? (
                        <View
                          style={[
                            styles.categoryChipRow,
                            isRtl
                              ? { direction: 'ltr', flexDirection: 'row-reverse' }
                              : null,
                          ]}
                        >
                          <View style={styles.categoryChip}>
                            <Text
                              style={[styles.categoryChipText, textDirStyle]}
                              numberOfLines={1}
                            >
                              {categoryName}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <Text style={[styles.title, textDirStyle]} numberOfLines={2}>
                        {p.title}
                      </Text>

                      <Text style={[styles.price, textDirStyle]} numberOfLines={1}>
                        {Number(p.price ?? 0).toLocaleString()}{' '}
                        <Text style={styles.priceUnit}>{t.egp}</Text>
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </DashboardLayout>
  )
}

const CARD_MIN = 160

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.ss,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.rl,
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
    color: colors.dk,
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
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
  cardWrap: {
    flexGrow: 1,
    flexBasis: CARD_MIN,
    maxWidth: '48%',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    overflow: 'hidden',
    ...shadow.ss,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  thumbWrap: {
    position: 'relative',
    aspectRatio: 1,
    backgroundColor: colors.g100,
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.g200,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    backgroundColor: colors.y,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    ...shadow.ss,
  },
  badgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: colors.dk,
    letterSpacing: 0.2,
  },
  heartBtn: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.ss,
  },

  body: {
    padding: spacing.md,
    gap: 6,
  },
  categoryChipRow: {
    flexDirection: 'row',
    width: '100%',
  },
  categoryChip: {
    backgroundColor: colors.g100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  categoryChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.g700,
    letterSpacing: 0.1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.g900,
    minHeight: 36,
  },
  price: {
    fontFamily: fonts.black,
    fontSize: 17,
    color: colors.dk,
    marginTop: 2,
  },
  priceUnit: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.g600,
  },
})
