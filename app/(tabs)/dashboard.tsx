import React, { useEffect, useState } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as StoreReview from 'expo-store-review'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AddProductDialog } from '@/components/AddProductDialog'
import { StoreLogoDialog } from '@/components/StoreLogoDialog'
import { SubscriptionExpiringDialog } from '@/components/SubscriptionExpiringDialog'
import { NotificationBell } from '@/components/NotificationBell'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { DashboardBroRequests } from '@/components/bro/DashboardBroRequests'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { IS_IOS, PAID_UI_ENABLED, PROMOTION_UI_ENABLED, SUBSCRIPTION_UI_ENABLED } from '@/lib/platform'
import { getStorePromotionOffer } from '@/lib/api'
import type { PendingUpgradeRequest, Product, PromoInfo, StorePromotionOffer, UserProfile, WalletBalance } from '@/lib/api'
import { bumpEngagement, markRated } from '@/lib/rate-app-engagement'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const APP_VERSION = Constants.expoConfig?.version ?? '—'

function normalizeType(t: string | null | undefined): 'client' | 'store' | 'unknown' {
  if (!t) return 'unknown'
  const v = t.toLowerCase()
  if (v === 'client') return 'client'
  if (v === 'store') return 'store'
  return 'unknown'
}

function formatPromoDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// LocaleProvider applies `direction: 'rtl'` at the tree root, which makes
// `row-reverse` resolve backwards (double-flip). Same fix as settings.tsx:
// force LTR + reversed rows so the first child anchors right in Arabic, then
// restore RTL inside text columns.
function useDir(ar: boolean) {
  return {
    rowDir: ar ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const } : null,
    colDir: ar ? { direction: 'rtl' as const } : null,
    dirStyle: { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const },
  }
}

async function rateApp() {
  try {
    const canReview = (await StoreReview.hasAction()) && (await StoreReview.isAvailableAsync())
    if (canReview) {
      markRated()
      await StoreReview.requestReview()
      return
    }
    const url = StoreReview.storeUrl()
    if (url) {
      markRated()
      await Linking.openURL(url)
    }
  } catch {
    // silent — nothing actionable
  }
}

export default function MoreScreen() {
  const { t, locale, setLocale } = useLocale()
  const { user, isAuthenticated, loading, logout } = useAuth()
  const ar = locale === 'ar'
  const broEnabled = useBroEnabled()
  const insets = useSafeAreaInsets()
  const { rowDir, colDir, dirStyle } = useDir(ar)

  const [adsCount, setAdsCount] = useState<number | null>(null)
  const [msgUnread, setMsgUnread] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [promoCredits, setPromoCredits] = useState<number | null>(null)
  const [adsError, setAdsError] = useState(false)
  const [msgError, setMsgError] = useState(false)
  const [walletError, setWalletError] = useState(false)
  const [promoError, setPromoError] = useState(false)
  const [pendingInstapay, setPendingInstapay] = useState(false)
  const [showLogoDialog, setShowLogoDialog] = useState(false)
  const [showAddProductDialog, setShowAddProductDialog] = useState(false)
  const [showExpiringDialog, setShowExpiringDialog] = useState(false)
  const [expiringEndsAt, setExpiringEndsAt] = useState<string | null>(null)
  const [pendingUpgrade, setPendingUpgrade] = useState<PendingUpgradeRequest | null>(null)
  // undefined = profile not loaded yet, null = not promoted, string = active promotion end (ISO)
  const [promotedUntil, setPromotedUntil] = useState<string | null | undefined>(undefined)
  const [promotionOffer, setPromotionOffer] = useState<StorePromotionOffer | null>(null)
  const [guestSettingsOpen, setGuestSettingsOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const load = async () => {
      // Promise.allSettled — one failed sub-fetch must not zero-out unrelated values.
      // See feedback: silent `?? 0` fallbacks previously made real ads look deleted.
      const results = await Promise.allSettled([
        authFetch<Product[]>('/products/mine'),
        authFetch<{ status: string; method: string }[]>('/payments/history'),
        authFetch<UserProfile>('/user/profile'),
        authFetch<{ count: number }>('/conversations/unread-count'),
        PAID_UI_ENABLED ? authFetch<WalletBalance>('/payments/wallet/balance') : Promise.resolve(null),
        PROMOTION_UI_ENABLED ? authFetch<PromoInfo>('/payments/promo-credits') : Promise.resolve(null),
        PROMOTION_UI_ENABLED ? getStorePromotionOffer() : Promise.resolve(null),
      ])
      if (cancelled) return

      const [adsR, paymentsR, profileR, unreadR, walletR, promoR, offerR] = results

      if (adsR.status === 'fulfilled') setAdsCount((adsR.value as Product[] | null)?.length ?? 0)
      else setAdsError(true)

      if (unreadR.status === 'fulfilled') setMsgUnread((unreadR.value as { count: number } | null)?.count ?? 0)
      else setMsgError(true)

      if (walletR.status === 'fulfilled') {
        const w = walletR.value as WalletBalance | null
        setWalletBalance(w ? Number(w.balance) : null)
      } else if (PAID_UI_ENABLED) {
        setWalletError(true)
      }

      if (promoR.status === 'fulfilled') {
        const p = promoR.value as PromoInfo | null
        setPromoCredits(p ? Number(p.total) : null)
      } else if (PROMOTION_UI_ENABLED) {
        setPromoError(true)
      }

      if (offerR.status === 'fulfilled') setPromotionOffer(offerR.value as StorePromotionOffer | null)

      if (paymentsR.status === 'fulfilled') {
        const payments = paymentsR.value as { status: string; method: string }[] | null
        setPendingInstapay(
          !!payments?.some((p) => p.method === 'instapay' && p.status === 'pending_verification'),
        )
      }

      if (profileR.status === 'fulfilled') {
        const profile = profileR.value as UserProfile | null
        setShowLogoDialog(!!profile?.flags?.showStoreLogoDialog)
        setShowAddProductDialog(!!profile?.flags?.showAddProductDialog)
        setPendingUpgrade(profile?.pendingUpgrade ?? null)
        const until = profile?.storeProfile?.promotedUntil ?? null
        setPromotedUntil(until && Date.parse(until) > Date.now() ? until : null)
        if (profile?.flags?.showSubscriptionExpiringDialog && profile?.flags?.subscriptionEndsAt) {
          setExpiringEndsAt(profile.flags.subscriptionEndsAt)
          setShowExpiringDialog(true)
        }
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

  const toggleLocale = () => setLocale(locale === 'ar' ? 'en' : 'ar')
  const rowProps = { ar, rowDir, colDir, dirStyle }
  const scrollPad = { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }

  const langButton = (
    <Pressable
      onPress={toggleLocale}
      accessibilityRole="button"
      accessibilityLabel={t.language}
      style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.langText}>{ar ? 'EN' : 'ع'}</Text>
    </Pressable>
  )

  // ── Guest ────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, scrollPad]}>
          <View style={[styles.guestTop, rowDir]}>{langButton}</View>

          <View style={styles.loginCard}>
            <Logo size="md" />
            <Text style={styles.loginTitle}>{t.signIn}</Text>
            <Text style={styles.loginSub}>
              {ar
                ? 'سجّل دخولك عشان توصل لإعلاناتك ورسائلك وحسابك'
                : 'Sign in to reach your ads, messages and account'}
            </Text>
            <View style={[styles.loginBtns, rowDir]}>
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryText}>{t.login}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(auth)/register')}
                style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={styles.btnOutlineText}>{t.register}</Text>
              </Pressable>
            </View>
          </View>

          <Section title={t.settings} dirStyle={dirStyle}>
            <MoreRow
              {...rowProps}
              icon="settings-outline"
              label={t.settings}
              sub={ar ? 'اللغة · قيّم التطبيق' : 'Language · Rate the app'}
              onPress={() => setGuestSettingsOpen(true)}
            />
          </Section>

          <Text style={styles.version}>{ar ? `الإصدار ${APP_VERSION}` : `Version ${APP_VERSION}`}</Text>
        </ScrollView>

        <Modal
          visible={guestSettingsOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setGuestSettingsOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setGuestSettingsOpen(false)}>
            <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
              <View style={styles.grabber} />
              <Text style={[styles.sheetTitle, dirStyle]}>{t.settings}</Text>
              <View style={styles.group}>
                <MoreRow
                  {...rowProps}
                  icon="globe-outline"
                  label={t.language}
                  trailing={ar ? 'العربية' : 'English'}
                  onPress={toggleLocale}
                />
                <MoreRow
                  {...rowProps}
                  icon="star-outline"
                  label={ar ? 'قيّم التطبيق' : 'Rate the app'}
                  onPress={() => void rateApp()}
                  last
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    )
  }

  // ── Signed in ────────────────────────────────────────────────────────────
  const type = normalizeType(user?.type)
  const isClient = type === 'client'
  const isStore = type === 'store'
  const name = user?.displayName ?? ''
  const initial = name.trim().charAt(0).toUpperCase() || 'V'

  const days = promotionOffer?.days
  const price = promotionOffer?.price
  const promoPriceLine =
    days == null
      ? null
      : IS_IOS
        ? `${days} ${ar ? 'أيام' : 'days'}`
        : `${price} ${ar ? 'ج.م' : 'EGP'} / ${days} ${ar ? 'أيام' : 'days'}`

  const adsValue = adsError ? '—' : adsCount == null ? '...' : String(adsCount)

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, scrollPad]}>
        {/* Header */}
        <View style={[styles.header, rowDir]}>
          <View style={[styles.avatar, isStore ? styles.avatarStore : styles.avatarClient]}>
            <Text style={[styles.avatarText, { color: isStore ? colors.y : colors.dk }]}>{initial}</Text>
          </View>
          <View style={[styles.headerText, colDir]}>
            <Text style={[styles.name, dirStyle]} numberOfLines={1}>{name}</Text>
            {!!user?.phone && <Text style={[styles.phone, dirStyle]}>{user.phone}</Text>}
            <View style={[styles.chipRow, rowDir]}>
              <View style={[styles.chip, isStore ? styles.chipStore : styles.chipClient]}>
                <Text style={styles.chipText}>
                  {isStore ? `🏪 ${t.storeTypeStore}` : `👤 ${ar ? 'مستخدم' : 'User'}`}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.headerBtns, rowDir]}>
            {langButton}
            <View style={styles.roundBtn}>
              <NotificationBell color={colors.dk} />
            </View>
          </View>
        </View>

        {/* Banner */}
        {isClient && SUBSCRIPTION_UI_ENABLED && (
          <Pressable
            disabled={!!pendingUpgrade}
            onPress={() => router.push('/dashboard/subscription')}
            style={({ pressed }) => [
              styles.banner,
              styles.bannerNavy,
              rowDir,
              !!pendingUpgrade && { opacity: 0.55 },
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.bannerText, colDir]}>
              <Text style={[styles.bannerTitle, { color: colors.white }, dirStyle]}>{t.upgClientToStoreTitle}</Text>
              <Text style={[styles.bannerSub, { color: 'rgba(255,255,255,0.75)' }, dirStyle]}>
                {t.upgClientToStoreSubtitle}
              </Text>
            </View>
            <View style={styles.bannerCta}>
              <Text style={styles.bannerCtaText}>{ar ? 'ابدأ الآن' : 'Start now'}</Text>
            </View>
          </Pressable>
        )}
        {isStore && PROMOTION_UI_ENABLED && promotedUntil !== undefined && (
          <Pressable
            onPress={() => router.push('/dashboard/promote-store')}
            style={({ pressed }) => [styles.banner, styles.bannerGold, rowDir, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            <View style={[styles.bannerText, colDir]}>
              <Text style={[styles.bannerTitle, { color: colors.dk }, dirStyle]}>
                {promotedUntil
                  ? ar
                    ? `🚀 متجرك مروّج حتى ${formatPromoDate(promotedUntil, locale)}`
                    : `🚀 Your store is promoted until ${formatPromoDate(promotedUntil, locale)}`
                  : ar
                    ? '🚀 روّج متجرك واظهر أولاً'
                    : '🚀 Promote your store and appear first'}
              </Text>
              {!!promoPriceLine && (
                <Text style={[styles.bannerSub, { color: colors.yt }, dirStyle]}>{promoPriceLine}</Text>
              )}
            </View>
            <View style={[styles.bannerCta, { backgroundColor: colors.dk }]}>
              <Text style={[styles.bannerCtaText, { color: colors.y }]}>
                {promotedUntil ? (ar ? 'تمديد الترويج' : 'Extend promotion') : ar ? 'روّج متجرك الآن' : 'Promote my store'}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Quick cards */}
        <View style={[styles.quickRow, rowDir]}>
          <QuickCard
            icon="list-outline"
            label={t.myAds}
            value={adsValue}
            dirStyle={dirStyle}
            onPress={() => router.push('/dashboard/my-ads')}
          />
          <QuickCard
            icon="chatbubble-outline"
            label={t.messages}
            value={msgError ? '—' : null}
            badge={msgUnread && msgUnread > 0 ? msgUnread : null}
            dirStyle={dirStyle}
            onPress={() => router.push('/dashboard/messages')}
          />
        </View>

        {/* Notices */}
        {PAID_UI_ENABLED && pendingInstapay && (
          <View style={[styles.notice, styles.noticeInstapay, rowDir]}>
            <View style={[styles.noticeIcon, { backgroundColor: 'rgba(252,211,77,0.18)' }]}>
              <Text style={{ fontSize: 16 }}>🕐</Text>
            </View>
            <View style={[styles.noticeText, colDir]}>
              <Text style={[styles.noticeTitle, { color: '#fcd34d' }, dirStyle]}>{t.instapayPendingTitle}</Text>
              <Text style={[styles.noticeSub, { color: 'rgba(255,255,255,0.78)' }, dirStyle]}>
                {t.instapayPendingSubtitle}
              </Text>
            </View>
          </View>
        )}
        {SUBSCRIPTION_UI_ENABLED && !!pendingUpgrade && (
          <View style={[styles.notice, styles.noticeUpgrade, rowDir]}>
            <View style={[styles.noticeIcon, { backgroundColor: 'rgba(245,184,0,0.22)' }]}>
              <Text style={{ fontSize: 16 }}>⏳</Text>
            </View>
            <View style={[styles.noticeText, colDir]}>
              <Text style={[styles.noticeTitle, { color: colors.dk }, dirStyle]}>{t.pendingUpgradeTitle}</Text>
              <Text style={[styles.noticeSub, { color: colors.dk, opacity: 0.8 }, dirStyle]}>
                {t.pendingUpgradeSubtitle}
              </Text>
            </View>
          </View>
        )}
        {broEnabled && <DashboardBroRequests />}

        {/* Dashboard */}
        <Section title={ar ? 'لوحة التحكم' : 'Dashboard'} dirStyle={dirStyle}>
          <MoreRow {...rowProps} icon="stats-chart-outline" label={t.analytics} onPress={() => router.push('/dashboard/analytics')} last />
        </Section>

        {/* My store */}
        {isStore && (
          <Section title={ar ? 'متجري' : 'My store'} dirStyle={dirStyle}>
            <MoreRow {...rowProps} icon="storefront-outline" label={t.storeInfo} onPress={() => router.push('/dashboard/store')} />
            <MoreRow {...rowProps} icon="logo-instagram" label={t.socialMedia} onPress={() => router.push('/dashboard/social')} />
            <MoreRow {...rowProps} icon="pricetags-outline" label={t.categoriesBrands} onPress={() => router.push('/dashboard/categories-brands')} />
            <MoreRow
              {...rowProps}
              icon="business-outline"
              label={t.branches}
              onPress={() => router.push('/dashboard/branches')}
              last={!PROMOTION_UI_ENABLED}
            />
            {PROMOTION_UI_ENABLED && (
              <MoreRow {...rowProps} icon="megaphone-outline" label={t.promoteStoreNav} onPress={() => router.push('/dashboard/promote-store')} last />
            )}
          </Section>
        )}

        {/* My activity */}
        <Section title={ar ? 'نشاطي' : 'My activity'} dirStyle={dirStyle}>
          {broEnabled && (
            <MoreRow
              {...rowProps}
              iconNode={<BroAvatar size={28} radius={14} />}
              label={t.bro.listTitle}
              onPress={() => router.push('/bro' as never)}
            />
          )}
          <MoreRow
            {...rowProps}
            icon="list-outline"
            label={t.myAds}
            trailing={adsValue}
            onPress={() => router.push('/dashboard/my-ads')}
            last={!PROMOTION_UI_ENABLED && !isClient}
          />
          {PROMOTION_UI_ENABLED && (
            <MoreRow
              {...rowProps}
              icon="rocket-outline"
              label={ar ? 'باقات ترويج الإعلانات' : 'Ad promotion bundles'}
              trailing={promoError ? '—' : promoCredits != null ? String(promoCredits) : undefined}
              onPress={() => router.push('/dashboard/promote')}
              last={!isClient}
            />
          )}
          {isClient && (
            <MoreRow {...rowProps} icon="ticket-outline" label={t.buySlotsNav} onPress={() => router.push('/dashboard/buy-slots')} last />
          )}
        </Section>

        {/* Following */}
        <Section title={ar ? 'المتابعة' : 'Following'} dirStyle={dirStyle}>
          <MoreRow {...rowProps} icon="heart-outline" label={t.favorites} onPress={() => router.push('/dashboard/favorites')} />
          <MoreRow {...rowProps} icon="people-outline" label={t.following} onPress={() => router.push('/dashboard/following')} last />
        </Section>

        {/* Payments */}
        <Section title={ar ? 'المدفوعات' : 'Payments'} dirStyle={dirStyle}>
          {SUBSCRIPTION_UI_ENABLED && (
            <MoreRow {...rowProps} icon="diamond-outline" label={t.subscription} onPress={() => router.push('/dashboard/subscription')} />
          )}
          {PAID_UI_ENABLED && (
            <MoreRow
              {...rowProps}
              icon="wallet-outline"
              label={t.wallet}
              trailing={
                walletError
                  ? '—'
                  : walletBalance != null
                    ? `${walletBalance.toLocaleString()} ${ar ? 'ج.م' : 'EGP'}`
                    : undefined
              }
              onPress={() => router.push('/dashboard/wallet')}
            />
          )}
          <MoreRow {...rowProps} icon="receipt-outline" label={t.invoices} onPress={() => router.push('/dashboard/invoices')} last />
        </Section>

        {/* Account */}
        <Section title={ar ? 'الحساب' : 'Account'} dirStyle={dirStyle}>
          <MoreRow {...rowProps} icon="person-outline" label={t.profile} onPress={() => router.push('/dashboard/profile')} />
          <MoreRow
            {...rowProps}
            icon="settings-outline"
            label={t.settings}
            sub={
              ar
                ? `اللغة · كلمة المرور · إشعارات البريد · قيّم التطبيق${IS_IOS ? ' · استعادة المشتريات' : ''} · حذف الحساب`
                : `Language · Password · Email alerts · Rate the app${IS_IOS ? ' · Restore purchases' : ''} · Delete account`
            }
            onPress={() => router.push('/dashboard/settings')}
            last
          />
        </Section>

        <View style={[styles.group, { marginTop: spacing.lg }]}>
          <MoreRow {...rowProps} icon="log-out-outline" label={t.logout} danger onPress={() => void logout()} last />
        </View>

        <Text style={styles.version}>{ar ? `الإصدار ${APP_VERSION}` : `Version ${APP_VERSION}`}</Text>
      </ScrollView>

      <StoreLogoDialog visible={showLogoDialog} onClose={() => setShowLogoDialog(false)} />
      <AddProductDialog visible={showAddProductDialog} onClose={() => setShowAddProductDialog(false)} />
      {expiringEndsAt && SUBSCRIPTION_UI_ENABLED && (
        <SubscriptionExpiringDialog
          visible={showExpiringDialog}
          onClose={() => setShowExpiringDialog(false)}
          subscriptionEndsAt={expiringEndsAt}
        />
      )}
    </View>
  )
}

type DirProps = ReturnType<typeof useDir>

function Section({ title, dirStyle, children }: { title: string; dirStyle: DirProps['dirStyle']; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, dirStyle]}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  )
}

function MoreRow({
  ar,
  rowDir,
  colDir,
  dirStyle,
  icon,
  iconNode,
  label,
  sub,
  trailing,
  danger,
  last,
  onPress,
}: DirProps & {
  ar: boolean
  icon?: IconName
  iconNode?: React.ReactNode
  label: string
  sub?: string
  trailing?: string
  danger?: boolean
  last?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, rowDir, !last && styles.rowDivider, pressed && { backgroundColor: colors.g50 }]}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.rl }]}>
        {iconNode ?? <Ionicons name={icon ?? 'ellipse-outline'} size={19} color={danger ? colors.red : colors.dk} />}
      </View>
      <View style={[styles.rowText, colDir]}>
        <Text style={[styles.rowLabel, danger && { color: colors.red }, dirStyle]}>{label}</Text>
        {!!sub && <Text style={[styles.rowSub, dirStyle]} numberOfLines={2}>{sub}</Text>}
      </View>
      {!!trailing && <Text style={styles.rowTrailing}>{trailing}</Text>}
      {!danger && <Ionicons name={ar ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.g400} />}
    </Pressable>
  )
}

function QuickCard({
  icon,
  label,
  value,
  badge,
  dirStyle,
  onPress,
}: {
  icon: IconName
  label: string
  value: string | null
  badge?: number | null
  dirStyle: DirProps['dirStyle']
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={colors.dk} />
        {!!badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.quickLabel, dirStyle]}>{label}</Text>
      {value != null && <Text style={[styles.quickValue, dirStyle]}>{value}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.g100 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarClient: { backgroundColor: colors.y },
  avatarStore: { backgroundColor: colors.dk },
  avatarText: { fontFamily: fonts.black, fontSize: 22 },
  headerText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.dk },
  phone: { fontFamily: fonts.regular, fontSize: 13, color: colors.g500 },
  chipRow: { flexDirection: 'row', marginTop: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full },
  chipClient: { backgroundColor: colors.yl },
  chipStore: { backgroundColor: 'rgba(6,43,91,0.08)' },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.dk },
  headerBtns: { flexDirection: 'row', gap: spacing.sm },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.ss,
  },
  langText: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.dk },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.lg },
  bannerNavy: { backgroundColor: colors.dk },
  bannerGold: { backgroundColor: colors.yl, borderWidth: 1.5, borderColor: colors.y },
  bannerText: { flex: 1, gap: 4 },
  bannerTitle: { fontFamily: fonts.extraBold, fontSize: 15 },
  bannerSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  bannerCta: { backgroundColor: colors.y, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  bannerCtaText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.dk },

  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
    ...shadow.ss,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.dk },
  quickValue: { fontFamily: fonts.black, fontSize: 20, color: colors.dk },
  badge: {
    position: 'absolute',
    top: -6,
    end: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },

  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  noticeInstapay: { backgroundColor: '#7c4a00' },
  noticeUpgrade: { backgroundColor: colors.yl, borderWidth: 1.5, borderColor: colors.y },
  noticeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  noticeText: { flex: 1, gap: 2 },
  noticeTitle: { fontFamily: fonts.black, fontSize: 14 },
  noticeSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },

  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.g500, paddingHorizontal: 4 },
  group: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', ...shadow.ss },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.g100 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.dk },
  rowSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.g500, lineHeight: 16 },
  rowTrailing: { fontFamily: fonts.bold, fontSize: 13, color: colors.g500 },

  version: { fontFamily: fonts.regular, fontSize: 12, color: colors.g400, textAlign: 'center', marginTop: spacing.sm },

  guestTop: { flexDirection: 'row' },
  loginCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  loginTitle: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.dk, textAlign: 'center' },
  loginSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.g500, textAlign: 'center', lineHeight: 20 },
  loginBtns: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
  btnPrimary: { flex: 1, backgroundColor: colors.y, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.dk },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.dk,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnOutlineText: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.dk },

  backdrop: { flex: 1, backgroundColor: 'rgba(6,20,40,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.g100,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.g300, marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.dk, marginBottom: spacing.xs },
})
