import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { AddProductDialog } from '@/components/AddProductDialog'
import { StoreLogoDialog } from '@/components/StoreLogoDialog'
import { SubscriptionExpiringDialog } from '@/components/SubscriptionExpiringDialog'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { PAID_UI_ENABLED } from '@/lib/platform'
import type { Analytics, FavoriteProduct, Product, PromoInfo, UserProfile, WalletBalance } from '@/lib/api'
import { bumpEngagement } from '@/lib/rate-app-engagement'
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
  const [msgUnread, setMsgUnread] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [promoCredits, setPromoCredits] = useState<number | null>(null)
  const [analyticsViews, setAnalyticsViews] = useState<number | null>(null)
  const [pendingInstapay, setPendingInstapay] = useState(false)
  const [showLogoDialog, setShowLogoDialog] = useState(false)
  const [showAddProductDialog, setShowAddProductDialog] = useState(false)
  const [showExpiringDialog, setShowExpiringDialog] = useState(false)
  const [expiringEndsAt, setExpiringEndsAt] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const load = async () => {
      const [ads, favs, payments, profile, unread, wallet, promo, analytics] = await Promise.all([
        authFetch<Product[]>('/products/mine'),
        authFetch<FavoriteProduct[]>('/products/favorites'),
        authFetch<{ status: string; method: string }[]>('/payments/history'),
        authFetch<UserProfile>('/user/profile'),
        authFetch<{ count: number }>('/conversations/unread-count'),
        PAID_UI_ENABLED ? authFetch<WalletBalance>('/payments/wallet/balance') : Promise.resolve(null),
        PAID_UI_ENABLED ? authFetch<PromoInfo>('/payments/promo-credits') : Promise.resolve(null),
        authFetch<Analytics>('/user/analytics'),
      ])
      if (cancelled) return
      setAdsCount(ads?.length ?? 0)
      setFavsCount(favs?.length ?? 0)
      setMsgUnread(unread?.count ?? 0)
      setWalletBalance(wallet ? Number(wallet.balance) : null)
      setPromoCredits(promo ? Number(promo.total) : null)
      setAnalyticsViews(analytics?.totalViews ?? 0)
      setPendingInstapay(
        !!payments?.some((p) => p.method === 'instapay' && p.status === 'pending_verification'),
      )
      setShowLogoDialog(!!profile?.flags?.showStoreLogoDialog)
      setShowAddProductDialog(!!profile?.flags?.showAddProductDialog)
      if (profile?.flags?.showSubscriptionExpiringDialog && profile?.flags?.subscriptionEndsAt) {
        setExpiringEndsAt(profile.flags.subscriptionEndsAt)
        setShowExpiringDialog(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    void bumpEngagement('dashboard_visit')
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

      {/* Shortcuts grid */}
      <View style={styles.statsGrid}>
        <StatTile
          value={adsCount}
          label={t.myAds}
          icon="list-outline"
          onPress={() => router.push('/dashboard/my-ads')}
        />
        <StatTile
          value={favsCount}
          label={t.favorites}
          icon="heart-outline"
          onPress={() => router.push('/dashboard/favorites')}
        />
        <StatTile
          value={msgUnread}
          label={t.messages}
          icon="chatbubble-outline"
          badge={msgUnread && msgUnread > 0 ? msgUnread : null}
          onPress={() => router.push('/dashboard/messages')}
        />
        {PAID_UI_ENABLED && (
          <StatTile
            value={walletBalance}
            label={t.wallet}
            icon="wallet-outline"
            onPress={() => router.push('/dashboard/wallet')}
          />
        )}
        {PAID_UI_ENABLED && (
          <StatTile
            value={promoCredits}
            label={t.promote}
            icon="star-outline"
            onPress={() => router.push('/dashboard/promote')}
          />
        )}
        <StatTile
          value={analyticsViews}
          label={t.analytics}
          icon="stats-chart-outline"
          onPress={() => router.push('/dashboard/analytics')}
        />
      </View>

      {/* Pending InstaPay notice — iOS hides paid surfaces (App Store §3.1.1) */}
      {pendingInstapay && PAID_UI_ENABLED && (
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

      {/* Client → Store upgrade — iOS hides paid surfaces (App Store §3.1.1) */}
      {isClient && PAID_UI_ENABLED && (
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

      {/* Store → Store Plus upgrade — iOS hides paid surfaces (App Store §3.1.1) */}
      {isStore && PAID_UI_ENABLED && (
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
          {/* Manage subscription — iOS hides paid entry (App Store §3.1.1) */}
          {PAID_UI_ENABLED && (
            <Pressable
              onPress={() => router.push('/dashboard/subscription')}
              style={({ pressed }) => [styles.plusCta, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.plusCtaText}>{t.manageSubscription}</Text>
            </Pressable>
          )}
        </View>
      )}

      <StoreLogoDialog visible={showLogoDialog} onClose={() => setShowLogoDialog(false)} />
      <AddProductDialog
        visible={showAddProductDialog}
        onClose={() => setShowAddProductDialog(false)}
      />
      {expiringEndsAt && PAID_UI_ENABLED && (
        <SubscriptionExpiringDialog
          visible={showExpiringDialog}
          onClose={() => setShowExpiringDialog(false)}
          subscriptionEndsAt={expiringEndsAt}
        />
      )}
    </DashboardLayout>
  )
}

function StatTile({
  value,
  label,
  icon,
  onPress,
  badge,
}: {
  value: number | null
  label: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
  onPress?: () => void
  badge?: number | null
}) {
  const content = (
    <>
      {icon && (
        <View style={styles.statIconWrap}>
          <Ionicons name={icon} size={18} color={colors.dk} />
          {badge && badge > 0 ? (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText} numberOfLines={1}>
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          ) : null}
        </View>
      )}
      <Text style={styles.statValue} numberOfLines={1}>
        {value === null ? '...' : String(value)}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.statTile, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={styles.statTile}>{content}</View>
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: 100,
    minWidth: 100,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    ...shadow.ss,
  },
  statIconWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  statBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
    lineHeight: 12,
  },
  statValue: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.yd,
  },
  statLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g500,
    marginTop: 2,
    textAlign: 'center',
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
