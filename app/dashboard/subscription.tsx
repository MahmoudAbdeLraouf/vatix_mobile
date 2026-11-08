import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ErrorState } from '@/components/ui/ErrorState'
import { UpgradeModal, UpgradeMode } from '@/components/UpgradeModal'
import { WalletTopupModal } from '@/components/WalletTopupModal'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import {
  getSiteSettings,
  getSubscriptionPlans,
  PaymentRecord,
  PlanData,
  SiteSettings,
  SubStatus,
  WalletBalance,
} from '@/lib/api'
import { StoreValue, StoreValueChips } from '@/components/StoreValue'
import { storePriceFromPlans, useStoreValueParams } from '@/lib/storeValue'
import { TRIAL_DAYS } from '@/lib/trial'
import { IS_IOS, PAID_UI_ENABLED, SUBSCRIPTION_UI_ENABLED } from '@/lib/platform'
import { fetchIosProducts } from '@/lib/iap'
import {
  SUBSCRIPTION_SKUS,
  SKU_SUBSCRIPTION_STORE,
  iosFallbackDisplayPrice,
} from '@/lib/iap-products'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

export default function SubscriptionScreen() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  // LocaleProvider applies `direction: 'rtl'` at the tree root. Under inherited
  // RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve visually
  // BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so the first
  // child anchors to the physical right. `colDir` restores RTL context inside
  // those rows so nested text uses `textAlign: 'auto'` = start alignment.
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const colDir = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const trailAlign = {
    alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
  }

  const type = (user?.type ?? 'client').toLowerCase()
  const isClient = type === 'client'
  const isStore = type === 'store'

  const [subInfo, setSubInfo] = useState<SubStatus | null>(null)
  const [history, setHistory] = useState<PaymentRecord[] | null>(null)
  const [walletBal, setWalletBal] = useState<number | null>(null)
  const [subPlans, setSubPlans] = useState<PlanData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // StoreKit-formatted prices keyed by SKU. iOS-only; empty on Android/web.
  // Sourced from App Store Connect so Apple's commission gross-up is reflected
  // without duplicating the pricing table in the client.
  const [iosPriceMap, setIosPriceMap] = useState<Record<string, string>>({})

  // Deep-link param. Signup/expired flows route here with ?upgrade=store to
  // drop the user directly into the purchase modal.
  const params = useLocalSearchParams<{ upgrade?: string }>()

  const [modal, setModal] = useState<UpgradeMode | null>(null)
  const [walletModal, setWalletModal] = useState(false)

  // Non-critical extras for the client upgrade pitch (ad cap, offer cap, trial
  // eligibility). Fetched outside loadAll so a failure here never blanks the
  // screen — the copy falls back to defaults.
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [profile, setProfile] = useState<{
    trialUsed?: boolean
    extraProductSlots?: number
    storeProfile?: { slug?: string | null } | null
  } | null>(null)
  const svp = useStoreValueParams()

  useEffect(() => {
    getSiteSettings().then(setSettings).catch(() => {})
    authFetch<{
      trialUsed?: boolean
      extraProductSlots?: number
      storeProfile?: { slug?: string | null } | null
    }>('/user/profile')
      .then(setProfile)
      .catch(() => {})
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [sub, hist, wal, plans] = await Promise.all([
        authFetch<SubStatus>('/payments/subscription-status'),
        authFetch<PaymentRecord[]>('/payments/history'),
        authFetch<WalletBalance>('/payments/wallet/balance'),
        getSubscriptionPlans().catch(() => [] as PlanData[]),
      ])
      setSubInfo(sub)
      setHistory(hist ?? [])
      setWalletBal(wal?.balance ?? 0)
      setSubPlans(plans)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Deep-link auto-open: ?upgrade=store drops the user directly into the
  // purchase modal.
  useEffect(() => {
    if (params.upgrade === 'store') setModal('upgrade-to-store')
  }, [params.upgrade])

  // Fetch StoreKit prices so the upgrade CTAs show the App-Store price the
  // user will actually be charged (Apple commission-inclusive), not the raw
  // backend EGP tier. Runs once; no cleanup needed — setState after unmount is
  // a no-op warning at worst.
  useEffect(() => {
    if (!IS_IOS) return
    let live = true
    ;(async () => {
      try {
        const products = await fetchIosProducts(SUBSCRIPTION_SKUS, 'subs')
        if (!live) return
        const map: Record<string, string> = {}
        for (const prod of products) {
          if (prod?.id && prod?.displayPrice) map[prod.id] = prod.displayPrice
        }
        setIosPriceMap(map)
      } catch {
        // Fall back to iosFallbackDisplayPrice — no user-visible error here;
        // UpgradeModal will surface StoreKit failures at purchase time.
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const refreshAfterUpgrade = useCallback(async () => {
    setModal(null)
    await loadAll()
  }, [loadAll])

  const refreshWallet = useCallback(async () => {
    setWalletModal(false)
    try {
      const fresh = await authFetch<WalletBalance>('/payments/wallet/balance')
      if (fresh) setWalletBal(fresh.balance)
    } catch {
      Alert.alert(t.error, t.errorRetryHint)
    }
  }, [t])

  // Plans are keyed by (storeType, billingCycle). Older seed rows omit
  // billingCycle — treat those as monthly so pre-migration DBs still resolve.
  const storeMonthly = useMemo(() => storePriceFromPlans(subPlans), [subPlans])
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')

  // On iOS the CTAs must show the App-Store price (commission-inclusive) —
  // showing the raw backend EGP would mislead the user about what Apple will
  // charge them. Falls back to the grossed-up ASC tier when StoreKit is
  // unreachable (Expo Go, dev, offline, pre-approval).
  const storeIosPrice = IS_IOS
    ? (iosPriceMap[SKU_SUBSCRIPTION_STORE] ??
      iosFallbackDisplayPrice(SKU_SUBSCRIPTION_STORE))
    : undefined
  const storePriceLine = storeIosPrice
    ? `${storeIosPrice} / ${t.monthlyBilling}`
    : `${fmt(storeMonthly)} ${ar ? 'ج.م' : 'EGP'} / ${t.monthlyBilling}`

  const isTrial = subInfo?.subscriptionStatus === 'trial'
  const isActive = subInfo?.subscriptionStatus === 'active'
  const daysLeft = subInfo?.daysLeft ?? null
  const subDaysLeft = subInfo?.subDaysLeft ?? null

  const TYPE_LABELS: Record<string, string> = {
    subscription_store: ar ? 'اشتراك متجر' : 'Store Subscription',
    subscription_store_plus: ar ? 'اشتراك ستور بلس (سابق)' : 'Store Plus subscription (legacy)',
    promotion_1ad: ar ? 'ترويج إعلان واحد' : 'Promo — 1 Ad',
    promotion_3ads: ar ? 'ترويج ٣ إعلانات' : 'Promo — 3 Ads',
    promotion_5ads: ar ? 'ترويج ٥ إعلانات' : 'Promo — 5 Ads',
    promotion_bundle: ar ? 'باقة ترويج' : 'Promo Bundle',
    wallet_topup: ar ? 'شحن محفظة' : 'Wallet Top-up',
  }

  const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    success: { label: ar ? 'مكتمل' : 'Completed', color: colors.green, bg: colors.greenBg },
    pending: { label: ar ? 'معلّق' : 'Pending', color: colors.yd, bg: colors.yellowBg },
    failed: { label: ar ? 'فشل' : 'Failed', color: colors.red, bg: colors.redBg },
    pending_verification: {
      label: ar ? 'قيد المراجعة' : 'Under Review',
      color: colors.yd,
      bg: colors.yellowBg,
    },
  }

  const subscriptionHistory = useMemo(
    () =>
      (history ?? []).filter(
        p => p.type === 'subscription_store' || p.type === 'subscription_store_plus',
      ),
    [history],
  )

  const remaining = isTrial ? daysLeft : subDaysLeft
  const endsAtIso = isTrial
    ? (subInfo?.trialEndsAt ?? subInfo?.subscriptionEndsAt)
    : subInfo?.subscriptionEndsAt
  const endsAtLabel = endsAtIso
    ? new Date(endsAtIso).toLocaleDateString(ar ? 'ar-EG' : 'en-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  // A week out is when the renew prompt moves to the top of the screen; the
  // backend's own expiry warning fires at 3 days.
  const isExpiring = isStore && remaining != null && remaining <= 7
  const progress = Math.min(
    100,
    Math.max(0, ((remaining ?? 0) / (isTrial ? TRIAL_DAYS : 30)) * 100),
  )
  const money = (n: number) => `${fmt(n)} ${ar ? 'ج.م' : 'EGP'}`
  // LTR isolate keeps "$9.99" from flipping to "9.99$" inside the RTL label.
  const renewPrice = storeIosPrice ? `\u2066${storeIosPrice}\u2069` : money(storeMonthly)
  // Mirrors the 04:00 wallet auto-renew cron (balance >= plan price).
  const walletEnough = (walletBal ?? 0) >= storeMonthly
  const shortfall = Math.max(0, storeMonthly - (walletBal ?? 0))
  const clientCap =
    (settings?.maxProductsPerClient ?? 10) + (profile?.extraProductSlots ?? 0)

  const statusTag = isExpiring
    ? { label: t.subStatusExpiring, bg: colors.orange, color: colors.white }
    : isTrial
      ? { label: t.subStatusTrial, bg: colors.y, color: colors.dk }
      : { label: t.subStatusActive, bg: colors.green, color: colors.white }

  const renewCta = (label: string) => (
    <Pressable
      onPress={() => setModal('upgrade-to-store')}
      style={({ pressed }) => [styles.ctaBtn, pressed && styles.actionPressed]}
    >
      <Text style={styles.ctaBtnText}>{label}</Text>
    </Pressable>
  )

  return (
    <DashboardLayout title={t.subscription}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.heading} />
        </View>
      ) : loadError ? (
        <ErrorState kind="network" onRetry={loadAll} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Client: upgrade pitch with one obvious CTA. iOS routes the
              purchase through Apple IAP inside the modal. */}
          {isClient && SUBSCRIPTION_UI_ENABLED && (
            <View style={styles.planCard}>
              <View style={colDir}>
                <Text style={[styles.planHeadText, dirStyle]}>{t.subUpgradeKicker}</Text>
                <Text style={[styles.planName, dirStyle]}>{t.subUpgradeTitle}</Text>
                <Text style={[styles.planMeta, dirStyle]}>
                  {fill(t.subCurrentClient, { cap: fmt(clientCap) })}
                </Text>
              </View>
              <StoreValueChips params={svp} short onDark style={{ marginTop: spacing.md }} />
              <View style={[styles.planPriceRow, rowDir]}>
                <Text style={styles.planPriceLabel}>{t.planCost}</Text>
                <Text style={styles.planPriceValue}>{storePriceLine}</Text>
              </View>
              {renewCta(t.subUpgradeCta)}
              {profile?.trialUsed !== true && (
                <Text style={styles.heroNote}>
                  {fill(t.subTrialNote, { days: fmt(TRIAL_DAYS) })}
                </Text>
              )}
            </View>
          )}

          {/* Store, ≤7 days left: renew prompt goes first */}
          {isExpiring && (
            <View style={styles.warnCard}>
              <View style={colDir}>
                <Text style={[styles.warnTitle, dirStyle]}>
                  {fill(t.subExpiringTitle, { days: fmt(remaining ?? 0) })}
                </Text>
                <Text style={[styles.warnBody, dirStyle]}>
                  {!IS_IOS && !walletEnough
                    ? fill(t.subExpiringWalletShort, { balance: money(walletBal ?? 0) })
                    : t.subExpiringBody}
                </Text>
              </View>
              {/* §6: what the renewal keeps — the itemized receipt. */}
              <StoreValue
                variant="receipt"
                params={svp}
                slug={profile?.storeProfile?.slug ?? undefined}
                priceLabel={storeIosPrice ?? null}
                amount={storeMonthly}
                showNow={false}
                style={{ marginTop: spacing.md }}
              />
              {SUBSCRIPTION_UI_ENABLED && renewCta(`${t.subRenewNow} — ${renewPrice}`)}
            </View>
          )}

          {/* Store: current plan */}
          {isStore && (
            <View style={styles.planCard}>
              <View style={[styles.spreadRow, rowDir]}>
                <Text style={styles.planHeadText}>{t.currentPlan}</Text>
                <View style={[styles.tag, { backgroundColor: statusTag.bg }]}>
                  <Text style={[styles.tagText, { color: statusTag.color }]}>
                    {statusTag.label}
                  </Text>
                </View>
              </View>
              <View style={colDir}>
                <Text style={[styles.planName, dirStyle]}>{t.standardStorePlan}</Text>
              </View>
              {(remaining != null || endsAtLabel) && (
                <View style={[styles.spreadRow, rowDir, { marginTop: 6 }]}>
                  {remaining != null && (
                    <Text style={styles.planMeta}>
                      {fill(t.subDaysLeft, { days: fmt(remaining) })}
                    </Text>
                  )}
                  {endsAtLabel && (
                    <Text
                      style={[styles.planMeta, isExpiring && { color: HERO_DANGER }]}
                    >
                      {fill(t.subEndsOn, { date: endsAtLabel })}
                    </Text>
                  )}
                </View>
              )}
              {remaining != null && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: isExpiring ? HERO_DANGER : colors.y,
                      },
                    ]}
                  />
                </View>
              )}
              {!isExpiring && (
                <>
                  <View style={[styles.planPriceRow, rowDir]}>
                    <Text style={styles.planPriceLabel}>{t.planCost}</Text>
                    <Text style={styles.planPriceValue}>{storePriceLine}</Text>
                  </View>
                  {SUBSCRIPTION_UI_ENABLED && (
                    <>
                      {renewCta(t.subRenewNow)}
                      {endsAtLabel && (
                        <Text style={styles.heroNote}>
                          {fill(t.subRenewKeepsDays, { date: endsAtLabel })}
                        </Text>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* Store: how auto-renewal works. iOS never mentions the wallet
              (App Store §3.1.1) and only claims App Store renewal once the
              store is on a paid plan — a trial has no Apple subscription. */}
          {isStore && (!IS_IOS || isActive) && (
            <View style={[styles.infoCard, rowDir]}>
              <Text style={styles.infoIcon}>🔄</Text>
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.actionTitle, dirStyle]}>{t.subAutoRenewTitle}</Text>
                <Text style={[styles.infoText, dirStyle]}>
                  {IS_IOS ? t.subAutoRenewIos : t.subAutoRenewWallet}
                </Text>
                {!IS_IOS && (
                  <View style={[styles.spreadRow, rowDir, { marginTop: spacing.sm }]}>
                    <Text style={styles.infoText}>
                      {t.subWalletYourBalance}{' '}
                      <Text style={styles.infoStrong}>{money(walletBal ?? 0)}</Text>
                    </Text>
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: walletEnough ? colors.greenBg : colors.redBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          { color: walletEnough ? colors.green : colors.red },
                        ]}
                      >
                        {walletEnough ? t.subWalletEnough : t.subWalletShort}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Store, expiring + wallet short: nudge toward a top-up so next
              month renews itself. Hidden on iOS (§3.1.1). */}
          {isExpiring && PAID_UI_ENABLED && !IS_IOS && shortfall > 0 && (
            <Pressable
              onPress={() => setWalletModal(true)}
              style={({ pressed }) => [
                styles.infoCard,
                rowDir,
                pressed && styles.actionPressed,
              ]}
            >
              <Text style={styles.infoIcon}>💡</Text>
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.infoText, dirStyle]}>
                  {fill(t.subTopupTip, { amount: money(shortfall) })}
                </Text>
              </View>
              <Ionicons
                name={ar ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.muted}
              />
            </Pressable>
          )}

          {/* Wallet balance card */}
          <View style={styles.walletCard}>
            <View style={[styles.walletHead, rowDir]}>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet" size={20} color={colors.seeAllText} />
              </View>
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.walletLabel, dirStyle]}>{t.walletBalance}</Text>
              </View>
            </View>
            <View style={colDir}>
              <Text style={[styles.walletValue, dirStyle]}>{money(walletBal ?? 0)}</Text>
            </View>
            {/* Top-up — iOS hides paid entry (App Store §3.1.1) */}
            {PAID_UI_ENABLED && (
              <Pressable
                style={({ pressed }) => [
                  styles.topupBtn,
                  rowDir,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => setWalletModal(true)}
              >
                <Ionicons name="add-circle" size={18} color={colors.seeAllText} />
                <Text style={[styles.topupBtnText, dirStyle]}>{t.topUpWallet}</Text>
              </Pressable>
            )}
          </View>

          {/* Subscription history — stores only; a client's is always empty */}
          {isStore && (
          <View style={styles.historyCard}>
            <View style={colDir}>
              <Text style={[styles.historyTitle, dirStyle]}>
                {t.subscriptionHistory}
              </Text>
            </View>
            {subscriptionHistory.length === 0 ? (
              <View style={colDir}>
                <Text style={[styles.emptyText, dirStyle]}>{t.noHistory}</Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {subscriptionHistory.map(p => {
                  const status = STATUS_LABELS[p.status] ?? {
                    label: p.status,
                    color: colors.muted,
                    bg: colors.placeholder,
                  }
                  return (
                    <View key={p.id} style={[styles.historyRow, rowDir]}>
                      <View style={[styles.actionBody, colDir]}>
                        <Text style={[styles.historyType, dirStyle]}>
                          {TYPE_LABELS[p.type] ?? p.type}
                        </Text>
                        <Text style={[styles.historyDate, dirStyle]}>
                          {new Date(p.createdAt).toLocaleDateString(
                            ar ? 'ar-EG' : 'en-EG',
                          )}
                          {p.method === 'instapay' && ' · InstaPay'}
                        </Text>
                      </View>
                      <View style={[styles.historyTrail, trailAlign, colDir]}>
                        <Text style={[styles.historyAmount, dirStyle]}>
                          {fmt(Number(p.metadata?.customerPrice ?? p.amount ?? 0))}{' '}
                          {ar ? 'ج.م' : (p.metadata?.customerCurrency ?? 'EGP')}
                        </Text>
                        <View
                          style={[styles.statusChip, { backgroundColor: status.bg }]}
                        >
                          <Text style={[styles.statusText, { color: status.color }, dirStyle]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
          )}

          {isStore && (
            <Pressable
              onPress={() => setModal('cancel-store')}
              hitSlop={8}
              style={({ pressed }) => [styles.cancelLink, pressed && styles.actionPressed]}
            >
              <Text style={styles.cancelLinkText}>{t.subCancelLink}</Text>
            </Pressable>
          )}
        </View>
      )}

      <UpgradeModal
        visible={!!modal}
        mode={modal ?? 'upgrade-to-store'}
        onClose={() => setModal(null)}
        onSuccess={refreshAfterUpgrade}
      />
      {/* Wallet top-up modal — iOS suppresses render (App Store §3.1.1) */}
      {PAID_UI_ENABLED && (
        <WalletTopupModal
          visible={walletModal}
          onClose={() => setWalletModal(false)}
          onSuccess={refreshWallet}
        />
      )}
    </DashboardLayout>
  )
}

// Light red that stays legible on the navy hero card.
const HERO_DANGER = '#FF8A80'

// Fills `{name}` placeholders in i18n strings.
const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    marginTop: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  planCard: {
    backgroundColor: colors.hero,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.md),
  },
  spreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planHeadText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.y,
  },
  planName: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.white,
    marginTop: 4,
  },
  planMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g200,
    marginTop: 2,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  tagText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
  },
  planPriceRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planPriceLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g200,
  },
  planPriceValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  ctaBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.y,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.dk,
  },
  heroNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g200,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  warnCard: {
    backgroundColor: colors.orangeBg,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warnTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.heading,
  },
  warnBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.ss),
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  infoStrong: {
    fontFamily: fonts.bold,
    color: colors.heading,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.heading,
  },
  cancelLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  cancelLinkText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.red,
    textDecorationLine: 'underline',
  },
  walletCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.sm),
  },
  walletHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.yellowBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  walletValue: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.price,
    marginTop: spacing.sm,
  },
  topupBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.yellowBg,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  topupBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.seeAllText,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.sm),
  },
  historyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.heading,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    paddingVertical: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyTrail: {
    gap: 4,
  },
  historyType: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.heading,
  },
  historyDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  historyAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
  },
  statusChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
})
