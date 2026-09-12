import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { PaymentRecord } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

export default function InvoicesScreen() {
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

  const [history, setHistory] = useState<PaymentRecord[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await authFetch<PaymentRecord[]>('/payments/history')
      const relevant = (data ?? []).filter(
        p => p.type.startsWith('subscription_') || p.type.startsWith('promotion_'),
      )
      setHistory(relevant)
    } catch (e) {
      setError(e as Error)
      setHistory([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')
  const currency = ar ? 'ج.م' : 'EGP'

  const TYPE_LABELS: Record<string, string> = {
    subscription_store: ar ? 'اشتراك متجر' : 'Store Sub',
    subscription_store_plus: ar ? 'اشتراك Store Plus' : 'Store Plus Sub',
    promotion_1ad: ar ? 'ترويج إعلان واحد' : 'Promo 1 Ad',
    promotion_3ads: ar ? 'ترويج ٣ إعلانات' : 'Promo 3 Ads',
    promotion_5ads: ar ? 'ترويج ٥ إعلانات' : 'Promo 5 Ads',
    promotion_bundle: ar ? 'باقة ترويج' : 'Promo Bundle',
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

  const methodLabel = (method: string | null): string | null => {
    if (!method) return null
    if (method === 'instapay') return 'InstaPay'
    if (method === 'mobile_wallet') return ar ? 'محفظة موبايل' : 'Mobile Wallet'
    if (method === 'wallet') return ar ? 'محفظة' : 'Wallet'
    return method
  }

  // Prefer metadata.customerPrice (what the buyer was actually charged on-channel,
  // e.g. Apple's App Store tier) over Payment.amount (net-proceeds recorded from
  // SubscriptionPlan.price) so the invoice total matches receipts the user has.
  const totalPaid = useMemo(
    () =>
      (history ?? [])
        .filter(p => p.status === 'success')
        .reduce(
          (s, p) => s + Number(p.metadata?.customerPrice ?? p.amount ?? 0),
          0,
        ),
    [history],
  )

  return (
    <DashboardLayout title={t.invoices}>
      {history === null && !error ? (
        <View style={{ gap: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <ErrorState kind="network" onRetry={load} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryHead, rowDir]}>
              <Ionicons name="receipt" size={18} color={colors.y} />
              <View style={[styles.actionBody, colDir]}>
                <Text style={[styles.summaryHeadText, dirStyle]}>
                  {ar ? 'إجمالي المدفوعات' : 'Total Paid'}
                </Text>
              </View>
            </View>
            <View style={colDir}>
              <Text style={[styles.summaryValue, dirStyle]}>
                {fmt(totalPaid)} <Text style={styles.summaryCurrency}>{currency}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.historyCard}>
            <View style={colDir}>
              <Text style={[styles.historyTitle, dirStyle]}>
                {ar ? 'سجل الفواتير' : 'Invoice History'}
              </Text>
            </View>

            {history && history.length === 0 ? (
              <EmptyState title={ar ? 'لا توجد فواتير بعد.' : 'No invoices yet.'} />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {(history ?? []).map(p => {
                  const status = STATUS_LABELS[p.status] ?? {
                    label: p.status,
                    color: colors.g600,
                    bg: colors.g100,
                  }
                  const method = methodLabel(p.method)
                  return (
                    <View key={p.id} style={[styles.row, rowDir]}>
                      <View style={styles.iconWrap}>
                        <Ionicons name="receipt-outline" size={18} color={colors.dk} />
                      </View>
                      <View style={[styles.actionBody, colDir, { minWidth: 0 }]}>
                        <Text style={[styles.rowType, dirStyle]} numberOfLines={1}>
                          {TYPE_LABELS[p.type] ?? p.type}
                        </Text>
                        <Text style={[styles.rowMeta, dirStyle]} numberOfLines={1}>
                          {new Date(p.createdAt).toLocaleDateString(
                            ar ? 'ar-EG' : 'en-EG',
                            { year: 'numeric', month: 'long', day: 'numeric' },
                          )}
                          {method ? ` · ${method}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.rowTrail, trailAlign, colDir]}>
                        <Text style={[styles.rowAmount, dirStyle]}>
                          {fmt(Number(p.metadata?.customerPrice ?? p.amount ?? 0))}{' '}
                          <Text style={styles.rowAmountCurrency}>
                            {ar ? currency : (p.metadata?.customerCurrency ?? currency)}
                          </Text>
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
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  summaryHeadText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.y,
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontFamily: fonts.extraBold,
    fontSize: 30,
    color: colors.y,
  },
  summaryCurrency: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.white,
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
  row: {
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
  rowTrail: {
    gap: 4,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yl,
  },
  rowType: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
  },
  rowMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
    marginTop: 2,
  },
  rowAmount: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  rowAmountCurrency: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
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
