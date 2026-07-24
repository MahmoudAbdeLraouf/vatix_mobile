import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { WalletTopupModal } from '@/components/WalletTopupModal'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { PaymentRecord, WalletBalance } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

export default function WalletScreen() {
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

  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<PaymentRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [topupModal, setTopupModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [wal, hist] = await Promise.all([
      authFetch<WalletBalance>('/payments/wallet/balance'),
      authFetch<PaymentRecord[]>('/payments/history'),
    ])
    setBalance(wal?.balance ?? 0)
    setHistory(hist ?? [])
    setLoading(false)
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
    subscription_store_plus: ar ? 'اشتراك Store Plus' : 'Store Plus Subscription',
    promotion_1ad: ar ? 'ترويج إعلان واحد' : 'Promo — 1 Ad',
    promotion_3ads: ar ? 'ترويج ٣ إعلانات' : 'Promo — 3 Ads',
    promotion_5ads: ar ? 'ترويج ٥ إعلانات' : 'Promo — 5 Ads',
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

  return (
    <DashboardLayout title={t.wallet}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.dk} />
        </View>
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
            <Pressable
              style={({ pressed }) => [styles.topupBtn, rowDir, pressed && styles.pressed]}
              onPress={() => setTopupModal(true)}
            >
              <Ionicons name="add-circle" size={18} color={colors.dk} />
              <Text style={[styles.topupBtnText, dirStyle]}>{t.topUpWallet}</Text>
            </Pressable>
          </View>

          {/* Stat cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, colDir, { borderColor: colors.gl }]}>
              <View style={[styles.statIcon, { backgroundColor: colors.gl }]}>
                <Ionicons name="arrow-up-circle" size={20} color={colors.green} />
              </View>
              <Text style={[styles.statLabel, dirStyle]}>{t.totalToppedUp}</Text>
              <Text style={[styles.statValue, dirStyle, { color: colors.green }]}>
                {fmt(totalTopup)} {currency}
              </Text>
            </View>
            <View style={[styles.statCard, colDir, { borderColor: colors.g200 }]}>
              <View style={[styles.statIcon, { backgroundColor: colors.yl }]}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.dk} />
              </View>
              <Text style={[styles.statLabel, dirStyle]}>{t.totalSpent}</Text>
              <Text style={[styles.statValue, dirStyle, { color: colors.dk }]}>
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
                    color: colors.g600,
                    bg: colors.g100,
                  }
                  return (
                    <View key={p.id} style={[styles.historyRow, rowDir]}>
                      <View
                        style={[
                          styles.dirIcon,
                          { backgroundColor: isTopup ? colors.gl : colors.yl },
                        ]}
                      >
                        <Ionicons
                          name={isTopup ? 'arrow-up' : 'arrow-down'}
                          size={18}
                          color={isTopup ? colors.green : colors.dk}
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
                            { color: isTopup ? colors.green : colors.dk },
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

      <WalletTopupModal
        visible={topupModal}
        onClose={() => setTopupModal(false)}
        onSuccess={() => {
          setTopupModal(false)
          load()
        }}
      />
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    ...shadow.ss,
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
    color: colors.g600,
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    marginTop: 4,
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
