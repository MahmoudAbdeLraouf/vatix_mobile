import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ErrorState } from '@/components/ui/ErrorState'
import { WalletTopupModal } from '@/components/WalletTopupModal'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { PAID_UI_ENABLED } from '@/lib/platform'
import { PaymentRecord, WalletBalance } from '@/lib/api'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

export default function WalletScreen() {
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

  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<PaymentRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [topupModal, setTopupModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [wal, hist] = await Promise.all([
        authFetch<WalletBalance>('/payments/wallet/balance'),
        authFetch<PaymentRecord[]>('/payments/history'),
      ])
      setBalance(wal?.balance ?? 0)
      setHistory(hist ?? [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')
  const currency = ar ? 'ج.م' : 'EGP'

  const walletHistory = useMemo(
    () => (history ?? []).filter(p => p.type === 'wallet_topup' || p.method === 'wallet'),
    [history],
  )

  const totalTopup = useMemo(
    () =>
      (history ?? [])
        .filter(p => p.type === 'wallet_topup' && p.status === 'success')
        .reduce((s, p) => s + Number(p.amount ?? 0), 0),
    [history],
  )

  const totalSpend = useMemo(
    () =>
      (history ?? [])
        .filter(
          p =>
            p.type !== 'wallet_topup' && p.method === 'wallet' && p.status === 'success',
        )
        .reduce((s, p) => s + Number(p.amount ?? 0), 0),
    [history],
  )

  const TYPE_LABELS: Record<string, string> = {
    subscription_store: ar ? 'اشتراك متجر' : 'Store Subscription',
    subscription_store_plus: ar ? 'اشتراك ستور بلس (سابق)' : 'Store Plus subscription (legacy)',
    promotion_store: ar ? 'ترويج المتجر' : 'Store promotion',
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

  return (
    <DashboardLayout title={t.wallet}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.heading} />
        </View>
      ) : loadError ? (
        <ErrorState kind="network" onRetry={load} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Balance card (primary) */}
          <View style={styles.balanceCard}>
            <View style={[styles.balanceHead, rowDir]}>
              <Ionicons name="wallet" size={18} color={colors.y} />
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.balanceHeadText, dirStyle]}>{t.walletBalance}</Text>
              </View>
            </View>
            <View style={colDir}>
              <Text style={[styles.balanceValue, dirStyle]}>
                {fmt(balance ?? 0)} <Text style={styles.balanceCurrency}>{currency}</Text>
              </Text>
            </View>
            {/* Top-up — iOS hides paid entry (App Store §3.1.1) */}
            {PAID_UI_ENABLED && (
              <Pressable
                style={({ pressed }) => [styles.topupBtn, rowDir, pressed && styles.pressed]}
                onPress={() => setTopupModal(true)}
              >
                <Ionicons name="add-circle" size={18} color={colors.dk} />
                <Text style={[styles.topupBtnText, dirStyle]}>{t.topUpWallet}</Text>
              </Pressable>
            )}
          </View>

          {/* Stat cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, colDir, { borderColor: colors.greenBg }]}>
              <View style={[styles.statIcon, { backgroundColor: colors.greenBg }]}>
                <Ionicons name="arrow-up-circle" size={20} color={colors.green} />
              </View>
              <Text style={[styles.statLabel, dirStyle]}>{t.totalToppedUp}</Text>
              <Text style={[styles.statValue, dirStyle, { color: colors.green }]}>
                {fmt(totalTopup)} {currency}
              </Text>
            </View>
            <View style={[styles.statCard, colDir, { borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: colors.yellowBg }]}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.seeAllText} />
              </View>
              <Text style={[styles.statLabel, dirStyle]}>{t.totalSpent}</Text>
              <Text style={[styles.statValue, dirStyle, { color: colors.heading }]}>
                {fmt(totalSpend)} {currency}
              </Text>
            </View>
          </View>

          {/* Transaction history */}
          <View style={styles.historyCard}>
            <View style={colDir}>
              <Text style={[styles.historyTitle, dirStyle]}>{t.transactionHistory}</Text>
            </View>
            {walletHistory.length === 0 ? (
              <View style={colDir}>
                <Text style={[styles.emptyText, dirStyle]}>{t.noTransactions}</Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {walletHistory.map(p => {
                  const isTopup = p.type === 'wallet_topup'
                  const status = STATUS_LABELS[p.status] ?? {
                    label: p.status,
                    color: colors.muted,
                    bg: colors.placeholder,
                  }
                  return (
                    <View key={p.id} style={[styles.historyRow, rowDir]}>
                      <View
                        style={[
                          styles.dirIcon,
                          { backgroundColor: isTopup ? colors.greenBg : colors.yellowBg },
                        ]}
                      >
                        <Ionicons
                          name={isTopup ? 'arrow-up' : 'arrow-down'}
                          size={18}
                          color={isTopup ? colors.green : colors.seeAllText}
                        />
                      </View>
                      <View style={[styles.actionBody, colDir]}>
                        <Text style={[styles.historyType, dirStyle]}>
                          {TYPE_LABELS[p.type] ?? p.type}
                        </Text>
                        <Text style={[styles.historyDate, dirStyle]}>
                          {new Date(p.createdAt).toLocaleDateString(
                            ar ? 'ar-EG' : 'en-EG',
                          )}
                        </Text>
                      </View>
                      <View style={[styles.historyTrail, trailAlign, colDir]}>
                        <Text
                          style={[
                            styles.historyAmount,
                            dirStyle,
                            { color: isTopup ? colors.green : colors.heading },
                          ]}
                        >
                          {isTopup ? '+' : '−'}
                          {fmt(Number(p.amount ?? 0))} {currency}
                        </Text>
                        <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
                          <Text style={[styles.statusText, { color: status.color }]}>
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

      {PAID_UI_ENABLED && (
        <WalletTopupModal
          visible={topupModal}
          onClose={() => setTopupModal(false)}
          onSuccess={() => {
            setTopupModal(false)
            load()
          }}
        />
      )}
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: colors.hero,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.md),
  },
  balanceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  balanceHeadText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.y,
    letterSpacing: 0.4,
  },
  balanceValue: {
    fontFamily: fonts.extraBold,
    fontSize: 34,
    color: colors.y,
  },
  balanceCurrency: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.white,
  },
  topupBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.y,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  topupBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  pressed: {
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    ...(dark ? null : shadow.ss),
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    marginTop: 4,
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
  actionBody: {
    flex: 1,
  },
  historyTrail: {
    gap: 4,
  },
  dirIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
