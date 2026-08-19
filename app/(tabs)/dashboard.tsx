import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { AddProductDialog } from '@/components/AddProductDialog'
import { StoreLogoDialog } from '@/components/StoreLogoDialog'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import type { FavoriteProduct, Product, UserProfile } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

function normalizeType(t: string | null | undefined): 'client' | 'store' | 'store_plus' | 'unknown' {
  if (!t) return 'unknown'
  const v = t.toLowerCase()
  if (v === 'client') return 'client'
  if (v === 'store') return 'store'
  if (v === 'store_plus') return 'store_plus'
  return 'unknown'
}

export default function DashboardScreen() {
  const { t, locale } = useLocale()
  const { user, isAuthenticated, loading } = useAuth()
  const ar = locale === 'ar'

  const [adsCount, setAdsCount] = useState<number | null>(null)
  const [favsCount, setFavsCount] = useState<number | null>(null)
  const [pendingInstapay, setPendingInstapay] = useState(false)
  const [showLogoDialog, setShowLogoDialog] = useState(false)
  const [showAddProductDialog, setShowAddProductDialog] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const load = async () => {
      const [ads, favs, payments, profile] = await Promise.all([
        authFetch<Product[]>('/products/mine'),
        authFetch<FavoriteProduct[]>('/products/favorites'),
        authFetch<{ status: string; method: string }[]>('/payments/history'),
        authFetch<UserProfile>('/user/profile'),
      ])
      if (cancelled) return
      setAdsCount(ads?.length ?? 0)
      setFavsCount(favs?.length ?? 0)
      setPendingInstapay(
        !!payments?.some((p) => p.method === 'instapay' && p.status === 'pending_verification'),
      )
      setShowLogoDialog(!!profile?.flags?.showStoreLogoDialog)
      setShowAddProductDialog(!!profile?.flags?.showAddProductDialog)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (loading) return null
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  const type = normalizeType(user?.type)
  const isClient = type === 'client'
  const isStore = type === 'store'
  const isStorePlus = type === 'store_plus'

  const welcome = t.welcomeName.replace('{name}', user?.displayName ?? '').replace(/،\s*(?=\s|👋)/, '')

  return (
    <DashboardLayout title={t.dashboardHome}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.welcome,
            { textAlign: 'auto', writingDirection: ar ? 'rtl' : 'ltr' },
          ]}
          numberOfLines={2}
        >
          {welcome}
        </Text>
        <Pressable
          onPress={() => router.push('/products/add')}
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={18} color={colors.dk} />
          <Text style={styles.newBtnText}>{t.newProductCta}</Text>
        </Pressable>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatTile value={adsCount} label={t.myAds} />
        <StatTile value={favsCount} label={t.favorites} />
      </View>

      {/* Pending InstaPay notice */}
      {pendingInstapay && (
        <View style={styles.instapayCard}>
          <View style={styles.instapayIconWrap}>
            <Text style={styles.instapayIcon}>🕐</Text>
          </View>
          <View style={styles.instapayBody}>
            <Text style={styles.instapayTitle}>{t.instapayPendingTitle}</Text>
            <Text style={styles.instapaySub}>{t.instapayPendingSubtitle}</Text>
          </View>
        </View>
      )}

      {/* Client → Store upgrade */}
      {isClient && (
        <UpgradeBanner
          variant="store"
          icon="storefront"
          badgeLabel={ar ? 'ترقية' : 'Upgrade'}
          title={t.upgClientToStoreTitle}
          subtitle={t.upgClientToStoreSubtitle}
          features={
            ar
              ? ['قوائم غير محدودة', 'صفحة متجر خاصة']
              : ['Unlimited listings', 'Private store page']
          }
          ctaLabel={ar ? 'ترقية إلى متجر' : 'Upgrade to Store'}
          onPress={() => router.push('/dashboard/subscription')}
          ar={ar}
        />
      )}

      {/* Store → Store Plus upgrade */}
      {isStore && (
        <UpgradeBanner
          variant="plus"
          icon="diamond"
          badgeLabel={ar ? 'مميز' : 'Premium'}
          title={t.upgStoreToPlusTitle}
          subtitle={t.upgStoreToPlusSubtitle}
          features={
            ar
              ? ['ترويج تلقائي للإعلانات', 'إحصائيات متقدمة', 'أولوية في البحث']
              : ['Auto-promoted listings', 'Advanced analytics', 'Search priority']
          }
          ctaLabel={ar ? 'ترقية الآن' : 'Upgrade Now'}
          onPress={() => router.push('/dashboard/subscription')}
          ar={ar}
        />
      )}

      {/* Store Plus active */}
      {isStorePlus && (
        <View style={styles.plusCard}>
          <View style={styles.plusLeft}>
            <View style={styles.plusIconWrap}>
              <Ionicons name="star" size={16} color={colors.dk} />
            </View>
            <View style={styles.plusTextWrap}>
              <Text style={styles.plusTitle}>{t.storePlusActive}</Text>
              <Text style={styles.plusSub}>{t.storePlusActiveSub}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/dashboard/subscription')}
            style={({ pressed }) => [styles.plusCta, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.plusCtaText}>{t.manageSubscription}</Text>
          </Pressable>
        </View>
      )}

      <StoreLogoDialog visible={showLogoDialog} onClose={() => setShowLogoDialog(false)} />
      <AddProductDialog
        visible={showAddProductDialog}
        onClose={() => setShowAddProductDialog(false)}
      />
    </DashboardLayout>
  )
}

function StatTile({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value === null ? '...' : String(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function UpgradeBanner({
  variant,
  icon,
  badgeLabel,
  title,
  subtitle,
  features,
  ctaLabel,
  onPress,
  ar,
}: {
  variant: 'store' | 'plus'
  icon: React.ComponentProps<typeof Ionicons>['name']
  badgeLabel: string
  title: string
  subtitle: string
  features: string[]
  ctaLabel: string
  onPress: () => void
  ar: boolean
}) {
  const isPlus = variant === 'plus'
  const dirStyle = { textAlign: 'auto' as const, writingDirection: ar ? ('rtl' as const) : ('ltr' as const) }

  return (
    <View style={styles.upgCard}>
      {/* Yellow top accent stripe */}
      <View style={styles.upgAccent} />

      {/* Header: badge + icon */}
      <View style={styles.upgHeader}>
        <View style={styles.upgBadge}>
          <View style={styles.upgBadgeDot} />
          <Text style={styles.upgBadgeText}>{badgeLabel}</Text>
        </View>
        <View style={[styles.upgIconWrap, isPlus && styles.upgIconWrapPlus]}>
          <Ionicons name={icon} size={20} color={colors.dk} />
        </View>
      </View>

      {/* Title + subtitle */}
      <Text style={[styles.upgTitle, dirStyle]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.upgSub, dirStyle]} numberOfLines={3}>
        {subtitle}
      </Text>

      {/* Features */}
      <View style={styles.upgFeatures}>
        {features.map((f) => (
          <View key={f} style={styles.upgFeatureRow}>
            <View style={styles.upgCheck}>
              <Ionicons name="checkmark" size={12} color={colors.dk} />
            </View>
            <Text style={[styles.upgFeatureText, dirStyle]} numberOfLines={1}>
              {f}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.upgCta, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.upgCtaText, dirStyle]} numberOfLines={1}>
          {ctaLabel}
        </Text>
        <Ionicons
          name={ar ? 'arrow-back' : 'arrow-forward'}
          size={16}
          color={colors.dk}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  welcome: {
    flex: 1,
    minWidth: 180,
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.y,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  newBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statTile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    ...shadow.ss,
  },
  statValue: {
    fontFamily: fonts.black,
    fontSize: 26,
    color: colors.yd,
  },
  statLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g500,
    marginTop: 4,
  },

  // Instapay
  instapayCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: '#7c4a00',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  instapayIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(252,211,77,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instapayIcon: {
    fontSize: 18,
  },
  instapayBody: {
    flex: 1,
    gap: 4,
  },
  instapayTitle: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: '#fcd34d',
  },
  instapaySub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },

  // Upgrade banner
  upgCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.dk,
    borderRadius: radius.xl,
    padding: spacing.md,
    paddingTop: spacing.md + 4,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  upgAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.y,
  },
  upgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  upgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,184,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,184,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  upgBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.y,
  },
  upgBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.y,
    letterSpacing: 0.3,
  },
  upgIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.ss,
  },
  upgIconWrapPlus: {
    backgroundColor: '#FFD166',
  },
  upgTitle: {
    fontFamily: fonts.black,
    fontSize: 17,
    color: colors.white,
    lineHeight: 24,
  },
  upgSub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 19,
  },
  upgFeatures: {
    gap: 8,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  upgFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  upgCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgFeatureText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.9)',
  },
  upgCta: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.y,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  upgCtaText: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },

  // Store Plus active
  plusCard: {
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.sm,
  },
  plusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTextWrap: {
    flex: 1,
    gap: 2,
  },
  plusTitle: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: colors.y,
  },
  plusSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  plusCta: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  plusCtaText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
})
