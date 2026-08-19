import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

interface ProductRow {
  id: number
  title: string
  isActive: boolean
  views: number
  phoneClicks: number
  whatsappClicks: number
  chats: number
  contacts: number
  favorites: number
  createdAt: string
}

interface DayRow {
  date: string
  count: number
}

interface Analytics {
  totalViews: number
  totalPhoneClicks: number
  totalWhatsappClicks?: number
  totalChats?: number
  totalContacts: number
  storePhoneClicks?: number
  storeWhatsappClicks?: number
  storeChats?: number
  storeContacts?: number
  totalFavorites: number
  totalProducts: number
  activeProducts: number
  products: ProductRow[]
  viewsByDay: DayRow[]
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

export default function AnalyticsScreen() {
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

  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<7 | 14 | 30>(30)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await authFetch<Analytics>('/user/analytics')
    setData(d ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')

  const days = useMemo(
    () => data?.viewsByDay.slice(-range) ?? [],
    [data, range],
  )

  const maxViews = useMemo(
    () => Math.max(...days.map(d => d.count), 1),
    [days],
  )

  const totalRange = useMemo(
    () => days.reduce((s, d) => s + d.count, 0),
    [days],
  )

  const productMax = useMemo(
    () => Math.max(...(data?.products ?? []).map(p => p.views), 1),
    [data],
  )

  const SUMMARY: {
    label: string
    value: number
    icon: IconName
    color: string
    bg: string
  }[] = data
    ? [
        {
          label: t.totalViews,
          value: data.totalViews,
          icon: 'eye-outline',
          color: colors.blue,
          bg: colors.bl,
        },
        {
          label: t.totalContact,
          value: data.totalContacts,
          icon: 'chatbubbles-outline',
          color: colors.green,
          bg: colors.gl,
        },
        {
          label: t.totalFavorites,
          value: data.totalFavorites,
          icon: 'heart-outline',
          color: colors.red,
          bg: colors.rl,
        },
        {
          label: t.totalProducts,
          value: data.totalProducts,
          icon: 'list-outline',
          color: colors.dk,
          bg: colors.g100,
        },
        {
          label: t.activeProducts,
          value: data.activeProducts,
          icon: 'checkmark-circle-outline',
          color: colors.green,
          bg: colors.gl,
        },
      ]
    : []

  const RANGES: (7 | 14 | 30)[] = [7, 14, 30]
  const rangeLabel: Record<7 | 14 | 30, string> = {
    7: t.last7Days,
    14: t.last14Days,
    30: t.last30Days,
  }

  return (
    <DashboardLayout title={t.analytics}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.dk} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Summary grid */}
          <View style={styles.summaryGrid}>
            {SUMMARY.map(s => (
              <View
                key={s.label}
                style={[styles.summaryCard, { backgroundColor: s.bg }]}
              >
                <View
                  style={[
                    styles.summaryIcon,
                    { backgroundColor: colors.white },
                  ]}
                >
                  <Ionicons name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={[styles.summaryValue, { color: s.color }]}>
                  {fmt(s.value)}
                </Text>
                <Text style={[styles.summaryLabel, dirStyle]}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Contact breakdown */}
          {data && (
            <View style={styles.card}>
              <Text
                style={[styles.cardTitle, dirStyle, { marginBottom: spacing.sm }]}
              >
                {t.totalContact}
              </Text>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Ionicons name="call-outline" size={16} color={colors.green} />
                  <Text style={[styles.breakdownValue, { color: colors.green }]}>
                    {fmt(data.totalPhoneClicks)}
                  </Text>
                  <Text style={styles.breakdownLabel}>{t.totalPhoneClicks}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={[styles.breakdownValue, { color: '#25D366' }]}>
                    {fmt(data.totalWhatsappClicks ?? 0)}
                  </Text>
                  <Text style={styles.breakdownLabel}>
                    {t.totalWhatsappClicks}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={16}
                    color={colors.blue}
                  />
                  <Text style={[styles.breakdownValue, { color: colors.blue }]}>
                    {fmt(data.totalChats ?? 0)}
                  </Text>
                  <Text style={styles.breakdownLabel}>
                    {t.totalChatContacts}
                  </Text>
                </View>
              </View>

              {data.storeContacts !== undefined &&
                data.storeContacts !== null &&
                data.storeContacts > 0 && (
                  <View style={styles.storeCallout}>
                    <Ionicons
                      name="storefront-outline"
                      size={16}
                      color={colors.dk}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.storeCalloutTitle, dirStyle]}>
                        {t.storeContacts} · {fmt(data.storeContacts)}
                      </Text>
                      <Text style={[styles.storeCalloutHint, dirStyle]}>
                        {t.storeContactsHint}
                      </Text>
                    </View>
                  </View>
                )}
            </View>
          )}

          {/* Daily views chart */}
          <View style={styles.card}>
            <View style={styles.chartHead}>
              <Text style={[styles.cardTitle, dirStyle]}>
                {t.viewsByDay}
              </Text>
              <View style={styles.rangeRow}>
                {RANGES.map(r => {
                  const active = range === r
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRange(r)}
                      style={({ pressed }) => [
                        styles.rangePill,
                        active && styles.rangePillActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rangePillText,
                          active && styles.rangePillTextActive,
                        ]}
                      >
                        {r} {ar ? 'يوم' : 'd'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {days.length === 0 || days.every(d => d.count === 0) ? (
              <Text style={styles.chartEmpty}>{t.noAnalyticsData}</Text>
            ) : (
              <View>
                <View style={styles.chartArea}>
                  {days.map(d => {
                    const h = Math.max(4, (d.count / maxViews) * 100)
                    return (
                      <View
                        key={d.date}
                        style={[
                          styles.bar,
                          {
                            height: `${h}%`,
                            backgroundColor:
                              d.count > 0 ? colors.blue : colors.g200,
                            opacity:
                              d.count > 0
                                ? 0.75 + (d.count / maxViews) * 0.25
                                : 1,
                          },
                        ]}
                      />
                    )
                  })}
                </View>
                <View style={styles.chartAxis}>
                  {days.map((d, i) => {
                    const show =
                      i === 0 ||
                      i === Math.floor(days.length / 2) ||
                      i === days.length - 1
                    return (
                      <Text key={d.date} style={styles.axisLabel}>
                        {show ? shortDate(d.date) : ''}
                      </Text>
                    )
                  })}
                </View>
                <Text style={styles.chartFooter}>
                  {ar
                    ? `المجموع: ${fmt(totalRange)} مشاهدة في ${rangeLabel[range]}`
                    : `Total: ${fmt(totalRange)} views · ${rangeLabel[range]}`}
                </Text>
              </View>
            )}
          </View>

          {/* Products performance */}
          <View style={styles.card}>
            <Text
              style={[styles.cardTitle, dirStyle, { marginBottom: spacing.md }]}
            >
              {t.productsPerformance}
            </Text>

            {!data?.products.length ? (
              <Text style={[styles.chartEmpty, dirStyle]}>
                {ar
                  ? 'لا توجد إعلانات بعد. أضف إعلانك الأول.'
                  : 'No listings yet. Post your first ad.'}
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {data.products.map(p => {
                  const barW = Math.max(
                    4,
                    Math.round((p.views / productMax) * 100),
                  )
                  return (
                    <View key={p.id} style={styles.pRow}>
                      <View style={styles.pHead}>
                        <Text
                          numberOfLines={1}
                          style={[styles.pTitle, dirStyle]}
                        >
                          {p.title}
                        </Text>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: p.isActive
                                ? colors.gl
                                : colors.rl,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              {
                                color: p.isActive ? colors.green : colors.red,
                              },
                            ]}
                          >
                            {p.isActive
                              ? ar
                                ? 'نشط'
                                : 'Active'
                              : ar
                                ? 'مخفي'
                                : 'Hidden'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pBarTrack}>
                        <View
                          style={[styles.pBarFill, { width: `${barW}%` }]}
                        />
                      </View>

                      <View style={styles.pStatsRow}>
                        <View style={styles.pStat}>
                          <Ionicons
                            name="eye-outline"
                            size={14}
                            color={colors.blue}
                          />
                          <Text
                            style={[styles.pStatValue, { color: colors.blue }]}
                          >
                            {fmt(p.views)}
                          </Text>
                        </View>
                        <View style={styles.pStat}>
                          <Ionicons
                            name="call-outline"
                            size={14}
                            color={colors.green}
                          />
                          <Text
                            style={[
                              styles.pStatValue,
                              { color: colors.green },
                            ]}
                          >
                            {fmt(p.phoneClicks)}
                          </Text>
                        </View>
                        <View style={styles.pStat}>
                          <Ionicons
                            name="logo-whatsapp"
                            size={14}
                            color="#25D366"
                          />
                          <Text
                            style={[styles.pStatValue, { color: '#25D366' }]}
                          >
                            {fmt(p.whatsappClicks ?? 0)}
                          </Text>
                        </View>
                        <View style={styles.pStat}>
                          <Ionicons
                            name="chatbubbles-outline"
                            size={14}
                            color={colors.dk}
                          />
                          <Text
                            style={[styles.pStatValue, { color: colors.dk }]}
                          >
                            {fmt(p.chats ?? 0)}
                          </Text>
                        </View>
                        <View style={styles.pStat}>
                          <Ionicons
                            name="heart-outline"
                            size={14}
                            color={colors.red}
                          />
                          <Text
                            style={[styles.pStatValue, { color: colors.red }]}
                          >
                            {fmt(p.favorites)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => router.push(`/products/${p.id}`)}
                          style={({ pressed }) => [
                            styles.viewBtn,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.viewBtnText}>
                            {ar ? 'عرض' : 'View'}
                          </Text>
                          <Ionicons
                            name={ar ? 'chevron-back' : 'chevron-forward'}
                            size={14}
                            color={colors.dk}
                          />
                        </Pressable>
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
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.ss,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryValue: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    lineHeight: 24,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rangePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.g200,
    backgroundColor: colors.white,
  },
  rangePillActive: {
    backgroundColor: colors.dk,
    borderColor: colors.dk,
  },
  rangePillText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g700,
  },
  rangePillTextActive: {
    color: colors.y,
  },
  chartEmpty: {
    paddingVertical: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
    paddingHorizontal: 2,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 4,
  },
  chartAxis: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  axisLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.g400,
    textAlign: 'center',
  },
  chartFooter: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    marginTop: 6,
    textAlign: 'center',
  },
  pRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
    gap: 8,
  },
  pHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pTitle: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  pBarTrack: {
    height: 4,
    backgroundColor: colors.g200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  pBarFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.g100,
  },
  breakdownValue: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  breakdownLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.g600,
  },
  storeCallout: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
  },
  storeCalloutTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.dk,
  },
  storeCalloutHint: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.g700,
    marginTop: 2,
  },
  pStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  pStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pStatValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  viewBtn: {
    marginStart: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.g200,
    backgroundColor: colors.white,
  },
  viewBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.dk,
  },
})
