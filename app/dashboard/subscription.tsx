import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { BillingCycle, UpgradeModal, UpgradeMode } from '@/components/UpgradeModal'
import { WalletTopupModal } from '@/components/WalletTopupModal'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import {
  getSubscriptionPlans,
  PaymentRecord,
  PlanData,
  SubStatus,
  WalletBalance,
} from '@/lib/api'
import { IS_IOS, PAID_UI_ENABLED, SUBSCRIPTION_UI_ENABLED } from '@/lib/platform'
import { fetchIosProducts } from '@/lib/iap'
import {
  SUBSCRIPTION_SKUS,
  iosFallbackDisplayPrice,
  subscriptionSkuForStoreType,
} from '@/lib/iap-products'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

export default function SubscriptionScreen() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const ar = locale === 'ar'

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
  const isStorePlus = type === 'store_plus'

  const [subInfo, setSubInfo] = useState<SubStatus | null>(null)
  const [history, setHistory] = useState<PaymentRecord[] | null>(null)
  const [walletBal, setWalletBal] = useState<number | null>(null)
  const [subPlans, setSubPlans] = useState<PlanData[]>([])
  const [loading, setLoading] = useState(true)
  // StoreKit-formatted prices keyed by SKU. iOS-only; empty on Android/web.
  // Sourced from App Store Connect so Apple's commission gross-up is reflected
  // without duplicating the pricing table in the client.
  const [iosPriceMap, setIosPriceMap] = useState<Record<string, string>>({})

  // Deep-link params. Signup/login redirect here with ?upgrade=…&cycle=yearly
  // when a store_plus purchase is required (e.g. Path A during signup, or the
  // expired-subscription flow). The cycle only applies to store_plus — the
  // regular store subscription is monthly-only.
  const params = useLocalSearchParams<{
    upgrade?: string
    cycle?: 'monthly' | 'yearly'
  }>()
  const paramCycle: BillingCycle = params.cycle === 'yearly' ? 'yearly' : 'monthly'

  const [modal, setModal] = useState<UpgradeMode | null>(null)
  const [walletModal, setWalletModal] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
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
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Deep-link auto-open: signup/expired flows route here with ?upgrade=plus
  // (or ?upgrade=store) to drop the user directly into the purchase modal.
  useEffect(() => {
    if (params.upgrade === 'plus') setModal('upgrade-to-plus')
    else if (params.upgrade === 'store') setModal('upgrade-to-store')
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
    const fresh = await authFetch<WalletBalance>('/payments/wallet/balance')
    if (fresh) setWalletBal(fresh.balance)
  }, [])

  // Plans are keyed by (storeType, billingCycle). Older seed rows omit
  // billingCycle — treat those as monthly so pre-migration DBs still resolve.
  const storeMonthly = useMemo(
    () =>
      Number(
        subPlans.find(
          p =>
            p.storeType === 'store' && (p.billingCycle ?? 'monthly') === 'monthly',
        )?.price ?? 300,
      ),
    [subPlans],
  )
  const plusMonthly = useMemo(
    () =>
      Number(
        subPlans.find(
          p =>
            p.storeType === 'store_plus' &&
            (p.billingCycle ?? 'monthly') === 'monthly',
        )?.price ?? 500,
      ),
    [subPlans],
  )
  const plusYearly = useMemo(
    () =>
      Number(
        subPlans.find(
          p => p.storeType === 'store_plus' && p.billingCycle === 'yearly',
        )?.price ?? 5000,
      ),
    [subPlans],
  )
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')

  // On iOS the CTAs must show the App-Store price (commission-inclusive) —
  // showing the raw backend EGP would mislead the user about what Apple will
  // charge them. Falls back to the grossed-up ASC tier when StoreKit is
  // unreachable (Expo Go, dev, offline, pre-approval).
  const storeIosPrice = IS_IOS
    ? (iosPriceMap[subscriptionSkuForStoreType('store')] ??
      iosFallbackDisplayPrice(subscriptionSkuForStoreType('store')))
    : undefined
  const plusIosPrice = IS_IOS
    ? (iosPriceMap[subscriptionSkuForStoreType('store_plus')] ??
      iosFallbackDisplayPrice(subscriptionSkuForStoreType('store_plus')))
    : undefined
  // iOS ignores paramCycle — App Store Connect only has monthly SKUs, so the
  // StoreKit-formatted price is always monthly. Android/web honor the deep-link
  // cycle so upgrade CTAs match the modal's initial selection.
  const plusCycle: BillingCycle = IS_IOS ? 'monthly' : paramCycle
  const plusBackendPrice = plusCycle === 'yearly' ? plusYearly : plusMonthly
  const cycleUnitFor = (c: BillingCycle) =>
    c === 'yearly' ? t.yearlyBilling : t.monthlyBilling
  const storePriceLine = storeIosPrice
    ? `${storeIosPrice} / ${t.monthlyBilling}`
    : `${fmt(storeMonthly)} ${ar ? 'ج.م' : 'EGP'} / ${t.monthlyBilling}`
  const plusPriceLine = plusIosPrice
    ? `${plusIosPrice} / ${t.monthlyBilling}`
    : `${fmt(plusBackendPrice)} ${ar ? 'ج.م' : 'EGP'} / ${cycleUnitFor(plusCycle)}`

  const isTrial = subInfo?.subscriptionStatus === 'trial'
  const isActive = subInfo?.subscriptionStatus === 'active'
  const daysLeft = subInfo?.daysLeft ?? null
  const subDaysLeft = subInfo?.subDaysLeft ?? null

  const TYPE_LABELS: Record<string, string> = {
    subscription_store: ar ? 'اشتراك متجر' : 'Store Subscription',
    subscription_store_plus: ar ? 'اشتراك Store Plus' : 'Store Plus Subscription',
    promotion_1ad: ar ? 'ترويج إعلان واحد' : 'Promo — 1 Ad',
    promotion_3ads: ar ? 'ترويج ٣ إعلانات' : 'Promo — 3 Ads',
    promotion_5ads: ar ? 'ترويج ٥ إعلانات' : 'Promo — 5 Ads',
    promotion_bundle: ar ? 'باقة ترويج' : 'Promo Bundle',
    wallet_topup: ar ? 'شحن محفظة' : 'Wallet Top-up',
  }

  const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    success: { label: ar ? 'مكتمل' : 'Completed', color: colors.green, bg: colors.gl },
    pending: { label: ar ? 'معلّق' : 'Pending', color: colors.yd, bg: colors.yl },
    failed: { label: ar ? 'فشل' : 'Failed', color: colors.red, bg: colors.rl },
    pending_verification: {
      label: ar ? 'قيد المراجعة' : 'Under Review',
      color: colors.yd,
      bg: colors.yl,
    },
  }

  const subscriptionHistory = useMemo(
    () =>
      (history ?? []).filter(
        p => p.type === 'subscription_store' || p.type === 'subscription_store_plus',
      ),
    [history],
  )

  const trialProgress = Math.min(
    100,
    Math.max(0, ((daysLeft ?? 0) / 30) * 100),
  )
  const trialDanger = (daysLeft ?? 0) <= 3
  const currentPlanLabel = isStorePlus
    ? t.storePlusPlan
    : isStore
      ? t.standardStorePlan
      : ar
        ? 'عميل'
        : 'Client'
  const currentPlanCost = isStorePlus ? plusMonthly : isStore ? storeMonthly : 0
  const currentPlanPriceLine = isStorePlus
    ? plusPriceLine
    : isStore
      ? storePriceLine
      : null

  return (
    <DashboardLayout title={t.subscription}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.dk} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Trial banner — stores only; clients don't have a subscription */}
          {!isClient && isTrial && daysLeft != null && (
            <View
              style={[
                styles.trialBanner,
                {
                  backgroundColor: trialDanger ? colors.rl : colors.yl,
                  borderColor: trialDanger ? colors.red : colors.y,
                },
              ]}
            >
              <View style={[styles.trialHead, rowDir]}>
                <Text style={styles.trialIcon}>{trialDanger ? '⚠️' : '🎁'}</Text>
                <View style={[styles.trialBody, colDir]}>
                  <Text
                    style={[
                      styles.trialTitle,
                      dirStyle,
                      { color: trialDanger ? colors.red : colors.yd },
                    ]}
                  >
                    {t.trialActive}
                  </Text>
                  <Text style={[styles.trialSub, dirStyle]}>
                    {ar
                      ? `متبقّي ${fmt(daysLeft)} يوم`
                      : `${fmt(daysLeft)} ${t.daysLeftLabel}`}
                  </Text>
                </View>
                {/* Renew — iOS routes through Apple IAP inside the modal.
                    Route to the user's actual tier so a normal-store user does
                    not accidentally get upgraded to Plus by tapping Renew. */}
                {SUBSCRIPTION_UI_ENABLED && (
                  <Pressable
                    onPress={() =>
                      setModal(isStorePlus ? 'upgrade-to-plus' : 'upgrade-to-store')
                    }
                    style={({ pressed }) => [
                      styles.renewBtn,
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <Text style={styles.renewBtnText}>
                      {ar ? 'جدّد ←' : 'Renew →'}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${trialProgress}%`,
                      backgroundColor: trialDanger ? colors.red : colors.y,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Current plan card — stores only; clients don't have a subscription */}
          {!isClient && (
          <View style={styles.planCard}>
            <View style={[styles.planHead, rowDir]}>
              <Ionicons name="diamond" size={18} color={colors.y} />
              <View style={[styles.planHeadTextWrap, colDir]}>
                <Text style={[styles.planHeadText, dirStyle]}>{t.currentPlan}</Text>
              </View>
            </View>
            <View style={[styles.planNameRow, rowDir]}>
              <Text style={[styles.planName, dirStyle]}>{currentPlanLabel}</Text>
              {isTrial && (
                <View style={styles.trialBadge}>
                  <Text style={styles.trialBadgeText}>{t.freeTrialBadge}</Text>
                </View>
              )}
            </View>
            {isActive && subDaysLeft != null && (
              <View style={colDir}>
                <Text style={[styles.planMeta, dirStyle]}>
                  {ar
                    ? `متبقّي ${fmt(subDaysLeft)} يوم على التجديد`
                    : `${fmt(subDaysLeft)} ${t.daysLeftLabel}`}
                </Text>
              </View>
            )}
            {subInfo?.subscriptionEndsAt && !isTrial && (
              <View style={colDir}>
                <Text style={[styles.planEnds, dirStyle]}>
                  {t.expiresOn}{' '}
                  {new Date(subInfo.subscriptionEndsAt).toLocaleDateString(
                    ar ? 'ar-EG' : 'en-EG',
                    { year: 'numeric', month: 'long', day: 'numeric' },
                  )}
                  {subDaysLeft != null && (
                    <Text
                      style={{
                        color: (subDaysLeft ?? 0) <= 7 ? colors.red : colors.g200,
                      }}
                    >
                      {' '}
                      ({fmt(subDaysLeft)} {ar ? 'يوم' : 'days'})
                    </Text>
                  )}
                </Text>
              </View>
            )}
            {currentPlanCost > 0 && currentPlanPriceLine && (
              <View style={[styles.planPriceRow, rowDir]}>
                <Text style={styles.planPriceLabel}>{t.planCost}</Text>
                <Text style={styles.planPriceValue}>
                  {currentPlanPriceLine}
                </Text>
              </View>
            )}
          </View>
          )}

          {/* Upgrade CTAs — iOS routes through Apple IAP inside the modal */}
          {isClient && SUBSCRIPTION_UI_ENABLED && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.actionCard,
                  rowDir,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => setModal('upgrade-to-store')}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="storefront" size={22} color={colors.y} />
                </View>
                <View style={[styles.actionBody, colDir]}>
                  <Text style={[styles.actionTitle, dirStyle]}>
                    {t.standardStorePlan}
                  </Text>
                  <Text style={[styles.actionSub, dirStyle]}>
                    {storePriceLine}
                  </Text>
                </View>
                <Ionicons
                  name={ar ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                  color={colors.g500}
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionCard,
                  rowDir,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => setModal('upgrade-to-plus')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.bl }]}>
                  <Ionicons name="diamond" size={22} color={colors.blue} />
                </View>
                <View style={[styles.actionBody, colDir]}>
                  <Text style={[styles.actionTitle, dirStyle]}>
                    {t.storePlusPlan}
                  </Text>
                  <Text style={[styles.actionSub, dirStyle]}>
                    {plusPriceLine}
                  </Text>
                </View>
                <Ionicons
                  name={ar ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                  color={colors.g500}
                />
              </Pressable>
            </>
          )}

          {isStore && SUBSCRIPTION_UI_ENABLED && (
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                rowDir,
                pressed && styles.actionPressed,
              ]}
              onPress={() => setModal('upgrade-to-plus')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.bl }]}>
                <Ionicons name="diamond" size={22} color={colors.blue} />
              </View>
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.actionTitle, dirStyle]}>
                  {t.upgradeToStorePlus}
                </Text>
                <Text style={[styles.actionSub, dirStyle]}>
                  {plusPriceLine}
                </Text>
              </View>
              <Ionicons
                name={ar ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={colors.g500}
              />
            </Pressable>
          )}

          {(isStore || isStorePlus) && (
            <Pressable
              style={({ pressed }) => [
                styles.cancelCard,
                rowDir,
                pressed && styles.actionPressed,
              ]}
              onPress={() => setModal('cancel-store')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.rl }]}>
                <Ionicons name="close-circle" size={22} color={colors.red} />
              </View>
              <View style={[styles.actionBody, colDir]}>
                <Text
                  style={[
                    styles.actionTitle,
                    dirStyle,
                    { color: colors.red },
                  ]}
                >
                  {t.cancelStore}
                </Text>
              </View>
            </Pressable>
          )}

          {/* Wallet balance card */}
          <View style={styles.walletCard}>
            <View style={[styles.walletHead, rowDir]}>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet" size={20} color={colors.dk} />
              </View>
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.walletLabel, dirStyle]}>{t.walletBalance}</Text>
              </View>
            </View>
            <View style={colDir}>
              <Text style={[styles.walletValue, dirStyle]}>
                {fmt(walletBal ?? 0)} {ar ? 'ج.م' : 'EGP'}
              </Text>
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
                <Ionicons name="add-circle" size={18} color={colors.dk} />
                <Text style={[styles.topupBtnText, dirStyle]}>{t.topUpWallet}</Text>
              </Pressable>
            )}
          </View>

          {/* Subscription history */}
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
                    color: colors.g600,
                    bg: colors.g100,
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
                          {fmt(Number(p.amount ?? 0))} {ar ? 'ج.م' : 'EGP'}
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
        </View>
      )}

      <UpgradeModal
        visible={!!modal}
        mode={modal ?? 'upgrade-to-store'}
        cycle={plusCycle}
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

const styles = StyleSheet.create({
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  trialBanner: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  trialHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trialBody: {
    flex: 1,
  },
  trialIcon: {
    fontSize: 26,
  },
  trialTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  trialSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g700,
    marginTop: 2,
  },
  renewBtn: {
    backgroundColor: colors.y,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  renewBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.dk,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  planCard: {
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  planHeadTextWrap: {
    flex: 1,
  },
  planHeadText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.y,
    letterSpacing: 0.4,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planName: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.white,
  },
  trialBadge: {
    backgroundColor: colors.y,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  trialBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.dk,
  },
  planMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g200,
    marginTop: 6,
  },
  planEnds: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g200,
    marginTop: 6,
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
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
  cancelCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.rl,
    ...shadow.ss,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  actionSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    marginTop: 2,
  },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.sm,
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
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g700,
  },
  walletValue: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.dk,
    marginTop: spacing.sm,
  },
  topupBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.yl,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  topupBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.sm,
  },
  historyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    paddingVertical: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  historyTrail: {
    gap: 4,
  },
  historyType: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
  },
  historyDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
    marginTop: 2,
  },
  historyAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
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
