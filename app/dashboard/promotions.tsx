import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import {
  imgUrl,
  PaymentRecord,
  PromoInfo,
  PromotionOrderItem,
  WalletBalance,
} from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type IonName = React.ComponentProps<typeof Ionicons>['name']

export default function PromotionsScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'

  // LocaleProvider applies `direction: 'rtl'` at the tree root. On iOS under
  // inherited RTL, `textAlign: 'right'` and `alignSelf: 'flex-end'` resolve to
  // logical-end = visual LEFT. `rowDir` forces LTR + reversed row so children
  // still lay out visually right-to-left. `colDir` restores RTL context inside
  // those forced-LTR rows so nested text uses natural start alignment.
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const colDir = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const trailAlign = { alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end' }

  const [credits, setCredits] = useState<PromoInfo | null>(null)
  const [wallet, setWallet] = useState<number | null>(null)
  const [orders, setOrders] = useState<PromotionOrderItem[]>([])
  const [payHistory, setPayHistory] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [c, w, o, ph] = await Promise.all([
      authFetch<PromoInfo>('/payments/promo-credits'),
      authFetch<WalletBalance>('/payments/wallet/balance'),
      authFetch<PromotionOrderItem[]>('/promotions/mine'),
      authFetch<PaymentRecord[]>('/payments/history'),
    ])
    setCredits(c ?? { total: 0, packs: [] })
    setWallet(w?.balance ?? 0)
    setOrders(o ?? [])
    setPayHistory((ph ?? []).filter(p => p.type && p.type.startsWith('promotion_')))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fmt = (n: number | string | null | undefined) =>
    Number(n ?? 0).toLocaleString(ar ? 'ar-EG' : 'en-EG')
  const currency = ar ? 'ج.م' : 'EGP'

  const PAY_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    success: { label: ar ? 'مكتمل' : 'Completed', color: colors.green, bg: colors.gl },
    pending: { label: ar ? 'معلّق' : 'Pending', color: colors.yd, bg: colors.yl },
    failed: { label: ar ? 'فشل' : 'Failed', color: colors.red, bg: colors.rl },
    pending_verification: {
      label: ar ? 'قيد المراجعة' : 'Under Review',
      color: colors.yd,
      bg: colors.yl,
    },
  }

  const PAY_TYPE_LABELS: Record<string, string> = {
    promotion_1ad: ar ? 'ترويج إعلان واحد' : 'Promo — 1 Ad',
    promotion_3ads: ar ? 'ترويج ٣ إعلانات' : 'Promo — 3 Ads',
    promotion_5ads: ar ? 'ترويج ٥ إعلانات' : 'Promo — 5 Ads',
  }

  const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: ar ? 'نشط' : 'Active', color: colors.green, bg: colors.gl },
    expired: { label: ar ? 'منتهي' : 'Expired', color: colors.g600, bg: colors.g100 },
    cancelled: { label: ar ? 'ملغى' : 'Cancelled', color: colors.red, bg: colors.rl },
  }

  const formatDate = (s: string) => new Date(s).toLocaleDateString(ar ? 'ar-EG' : 'en-EG')

  const daysLeft = (endDate: string) => {
    const ms = new Date(endDate).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  }

  const activeOrders = orders.filter(o => o.status === 'active')
  const hasAnyContent =
    (credits?.total ?? 0) > 0 ||
    orders.length > 0 ||
    payHistory.length > 0

  const title = ar ? 'باقات الترويج' : 'My Promotions'

  // ---------- Inline building blocks ----------

  const Chip = ({
    label,
    color,
    bg,
  }: {
    label: string
    color: string
    bg: string
  }) => (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  )

  const SectionHeader = ({
    icon,
    tint,
    tintBg,
    title,
    subtitle,
    count,
  }: {
    icon: IonName
    tint: string
    tintBg: string
    title: string
    subtitle?: string
    count?: number
  }) => (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionHeadRow, rowDir]}>
        <View style={[styles.sectionIconTile, { backgroundColor: tintBg }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <View style={[styles.sectionHeadBody, colDir]}>
          <Text style={[styles.sectionTitle, dirStyle]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.sectionSub, dirStyle]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {typeof count === 'number' && count > 0 ? (
          <View style={[styles.sectionCountPill, { backgroundColor: tintBg }]}>
            <Text style={[styles.sectionCountText, { color: tint }]}>{fmt(count)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )

  return (
    <DashboardLayout title={title}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.dk} />
        </View>
      ) : !hasAnyContent ? (
        <>
          <View style={[styles.hero, rowDir]}>
            <View style={styles.heroIcon}>
              <Ionicons name="rocket" size={22} color={colors.dk} />
            </View>
            <View style={[styles.heroBody, colDir]}>
              <Text style={[styles.heroTitle, dirStyle]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.heroSubtitle, dirStyle]} numberOfLines={1}>
                {ar ? 'روِّج إعلاناتك إلى المقدمة' : 'Boost your ads to the top'}
              </Text>
            </View>
          </View>

          <EmptyState
            icon={<Ionicons name="rocket-outline" size={30} color={colors.dk} />}
            title={ar ? 'لا توجد باقات ترويج بعد' : 'No promotions yet'}
            subtitle={
              ar
                ? 'اشترِ باقة ترويج لإبراز إعلاناتك في مقدمة نتائج البحث'
                : 'Buy a promotion bundle to boost your ads to the top of search results'
            }
            actionLabel={ar ? 'اشترِ باقة ترويج' : 'Buy a Promo Pack'}
            onAction={() => router.push('/dashboard/promote')}
          />
        </>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Hero header */}
          <View style={[styles.hero, rowDir]}>
            <View style={styles.heroIcon}>
              <Ionicons name="rocket" size={22} color={colors.dk} />
            </View>
            <View style={[styles.heroBody, colDir]}>
              <Text style={[styles.heroTitle, dirStyle]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.heroSubtitle, dirStyle]} numberOfLines={1}>
                {ar
                  ? 'تتبّع باقاتك ومدفوعاتك في مكان واحد'
                  : 'Track bundles, ads & payments in one place'}
              </Text>
            </View>
            {activeOrders.length > 0 && (
              <View style={styles.heroCountPill}>
                <Text style={styles.heroCountPillText}>{fmt(activeOrders.length)}</Text>
              </View>
            )}
          </View>

          {/* Metric hero: credits + wallet + CTA */}
          <View style={styles.metricCard}>
            <View style={[styles.metricRow, rowDir]}>
              <View style={[styles.metricCol, colDir]}>
                <View style={[styles.metricHead, rowDir]}>
                  <Ionicons name="flash" size={12} color={colors.y} />
                  <Text style={[styles.metricHeadText, dirStyle]}>
                    {(ar ? 'رصيد الترويج' : 'Promo Credits').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.metricBigYellow, dirStyle]}>
                  {fmt(credits?.total ?? 0)}
                </Text>
                <Text style={[styles.metricSub, dirStyle]} numberOfLines={1}>
                  {ar ? 'إعلان متاح' : 'ads available'}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={[styles.metricCol, colDir]}>
                <View style={[styles.metricHead, rowDir]}>
                  <Ionicons name="wallet" size={12} color={colors.white} />
                  <Text style={[styles.metricHeadText, dirStyle, { color: colors.white }]}>
                    {(ar ? 'المحفظة' : 'Wallet').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.metricBigWhite, dirStyle]}>
                  {fmt(wallet ?? 0)}
                  <Text style={styles.metricCurrency}>{' ' + currency}</Text>
                </Text>
                <Pressable
                  onPress={() => router.push('/dashboard/wallet')}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={[styles.metricLink, dirStyle]} numberOfLines={1}>
                    {ar ? 'إدارة المحفظة ←' : 'Manage wallet →'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/dashboard/promote')}
              style={({ pressed }) => [styles.metricCta, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle" size={16} color={colors.dk} />
              <Text style={styles.metricCtaText}>
                {ar ? 'اشترِ باقة جديدة' : 'Buy New Bundle'}
              </Text>
            </Pressable>
          </View>

          {/* Active Promotions */}
          {activeOrders.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="trending-up"
                tint={colors.green}
                tintBg={colors.gl}
                title={ar ? 'الترويجات النشطة' : 'Active Promotions'}
                subtitle={ar ? 'الباقات التي لا تزال سارية' : 'Bundles still running'}
                count={activeOrders.length}
              />

              <View style={{ gap: spacing.sm }}>
                {activeOrders.map(o => {
                  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.active
                  const firstThumb = imgUrl(o.products?.[0]?.product?.images?.[0]?.url)
                  const dLeft = daysLeft(o.endDate)
                  return (
                    <View key={o.id} style={[styles.activeRow, rowDir]}>
                      {firstThumb ? (
                        <Image source={{ uri: firstThumb }} style={styles.activeThumb} />
                      ) : (
                        <View style={[styles.activeThumb, styles.thumbFallback]}>
                          <Ionicons name="image" size={20} color={colors.g500} />
                        </View>
                      )}
                      <View style={[styles.rowBody, colDir]}>
                        <Text style={[styles.rowTitle, dirStyle]} numberOfLines={1}>
                          {o.bundle?.name ?? (ar ? 'باقة ترويج' : 'Promotion bundle')}
                        </Text>
                        <Text style={[styles.rowMeta, dirStyle]} numberOfLines={1}>
                          {formatDate(o.startDate)} — {formatDate(o.endDate)}
                        </Text>
                        <View style={[styles.rowAccentLine, rowDir]}>
                          <Ionicons name="time" size={11} color={colors.green} />
                          <Text style={[styles.rowAccent, dirStyle]} numberOfLines={1}>
                            {ar ? `متبقٍ ${fmt(dLeft)} يوم` : `${fmt(dLeft)} days left`}
                            {o.products?.length
                              ? ` · ${fmt(o.products.length)} ${ar ? 'إعلان' : 'ads'}`
                              : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.rowTrail, trailAlign]}>
                        <Chip label={st.label} color={st.color} bg={st.bg} />
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* Current Packs */}
          {(credits?.packs?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="cube"
                tint={colors.dk}
                tintBg={colors.yl}
                title={ar ? 'الباقات الحالية' : 'My Packs'}
                subtitle={
                  ar
                    ? 'استخدم رصيدك لترويج إعلاناتك'
                    : 'Use credits to promote your listings'
                }
              />

              <View style={{ gap: spacing.sm }}>
                {(credits?.packs ?? []).map(p => (
                  <View key={p.id} style={[styles.packRow, rowDir]}>
                    <View style={styles.packIcon}>
                      <Ionicons name="flash" size={16} color={colors.dk} />
                    </View>
                    <View style={[styles.rowBody, colDir]}>
                      <Text style={[styles.rowTitle, dirStyle]} numberOfLines={1}>
                        {ar ? 'باقة ترويج' : 'Promo pack'}
                      </Text>
                      <Text style={[styles.rowMeta, dirStyle]} numberOfLines={1}>
                        {ar
                          ? `${fmt(p.boostDays)} يوم لكل إعلان · ${formatDate(p.createdAt)}`
                          : `${fmt(p.boostDays)} days per ad · ${formatDate(p.createdAt)}`}
                      </Text>
                    </View>
                    <View style={[styles.packCountBox, trailAlign]}>
                      <Text style={styles.packCount}>{fmt(p.remaining)}</Text>
                      <Text style={styles.packCountLabel}>
                        {ar ? 'متبقٍ' : 'left'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Purchased Bundles */}
          {orders.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="pricetags"
                tint={colors.dk}
                tintBg={colors.g100}
                title={ar ? 'الباقات المشتراة' : 'Purchased Bundles'}
                subtitle={ar ? 'سجل جميع الباقات' : 'All bundle purchases'}
                count={orders.length}
              />

              <View>
                {orders.map((o, idx) => {
                  const st = ORDER_STATUS[o.status] ?? {
                    label: o.status,
                    color: colors.g600,
                    bg: colors.g100,
                  }
                  return (
                    <View
                      key={o.id}
                      style={[
                        styles.divRow,
                        rowDir,
                        idx === orders.length - 1 && styles.divRowLast,
                      ]}
                    >
                      <View style={[styles.rowIconTile, { backgroundColor: st.bg }]}>
                        <Ionicons name="pricetag" size={14} color={st.color} />
                      </View>
                      <View style={[styles.rowBody, colDir]}>
                        <Text style={[styles.rowTitle, dirStyle]} numberOfLines={1}>
                          {o.bundle?.name ?? (ar ? 'باقة ترويج' : 'Promotion bundle')}
                        </Text>
                        <Text style={[styles.rowMeta, dirStyle]} numberOfLines={1}>
                          {formatDate(o.startDate)} — {formatDate(o.endDate)}
                        </Text>
                      </View>
                      <View style={[styles.rowTrail, trailAlign]}>
                        <Text style={styles.rowAmount}>
                          {fmt(o.amount)} {currency}
                        </Text>
                        <Chip label={st.label} color={st.color} bg={st.bg} />
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* Payment History */}
          {payHistory.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="receipt"
                tint={colors.dk}
                tintBg={colors.g100}
                title={ar ? 'سجل مدفوعات الترويج' : 'Promotion Payments'}
                subtitle={ar ? 'كل عمليات الدفع' : 'All promotion payments'}
              />

              <View>
                {payHistory.map((p, idx) => {
                  const st = PAY_STATUS_LABELS[p.status] ?? {
                    label: p.status,
                    color: colors.g600,
                    bg: colors.g100,
                  }
                  return (
                    <View
                      key={p.id}
                      style={[
                        styles.divRow,
                        rowDir,
                        idx === payHistory.length - 1 && styles.divRowLast,
                      ]}
                    >
                      <View style={[styles.rowIconTile, { backgroundColor: colors.g100 }]}>
                        <Ionicons name="card" size={14} color={colors.dk} />
                      </View>
                      <View style={[styles.rowBody, colDir]}>
                        <Text style={[styles.rowTitle, dirStyle]} numberOfLines={1}>
                          {PAY_TYPE_LABELS[p.type] ?? p.type}
                        </Text>
                        <Text style={[styles.rowMeta, dirStyle]} numberOfLines={1}>
                          {formatDate(p.createdAt)}
                          {p.method ? ` · ${p.method}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.rowTrail, trailAlign]}>
                        <Text style={styles.rowAmount}>
                          {fmt(p.amount)} {currency}
                        </Text>
                        <Chip label={st.label} color={st.color} bg={st.bg} />
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* Bottom CTA */}
          <View style={{ marginTop: spacing.sm }}>
            <Button
              variant="cta"
              size="lg"
              fullWidth
              onPress={() => router.push('/dashboard/promote')}
              label={ar ? 'اشترِ باقة أخرى ←' : 'Buy Another Bundle →'}
            />
          </View>
        </View>
      )}
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },

  // Hero header
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    ...shadow.ss,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
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
    color: colors.dk,
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
  },
  heroCountPill: {
    minWidth: 32,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.dk,
  },

  // Metric card (credits + wallet)
  metricCard: {
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricCol: {
    flex: 1,
    gap: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.dk3,
    marginHorizontal: spacing.md,
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricHeadText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.y,
    letterSpacing: 0.4,
  },
  metricBigYellow: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: colors.y,
    lineHeight: 32,
  },
  metricBigWhite: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.white,
    lineHeight: 26,
  },
  metricCurrency: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g300,
  },
  metricSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.white,
    opacity: 0.7,
  },
  metricLink: {
    marginTop: 2,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.y,
  },
  metricCta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.y,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  metricCtaText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.dk,
    letterSpacing: 0.2,
  },

  // Section container
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    gap: spacing.md,
    ...shadow.ss,
  },
  sectionHead: {},
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.dk,
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
  },
  sectionCountPill: {
    minWidth: 28,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
  },

  // Shared row body & trail
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  rowMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
  },
  rowAccent: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.green,
  },
  rowAccentLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowTrail: {
    gap: 6,
    justifyContent: 'center',
  },
  rowAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.dk,
  },
  rowIconTile: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active promotions row (card-like)
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.g100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  activeThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.g200,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Packs row
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.yl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.y,
  },
  packIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCountBox: {
    minWidth: 44,
  },
  packCount: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.dk,
    lineHeight: 22,
  },
  packCountLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.g600,
  },

  // Divider row (bundles + payments)
  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  divRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  // Chip
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
})
