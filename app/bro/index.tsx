import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { getBroRequest, listBroRequests, type BroRequest, type BroRequestStatus, type BroRequestView } from '@/lib/bro'
import { Button } from '@/components/ui/Button'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { BroRequestRow } from '@/components/bro/BroRequestRow'
import { useBroDir } from '@/components/bro/BroCardParts'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

// The list endpoint returns bare requests, so views (counts + offers) are fetched per row. Cap it to bound the fan-out.
const COUNT_ROWS = 20

type Filter = 'all' | 'searching' | 'found' | 'ended'

function filterOf(status: BroRequestStatus): Exclude<Filter, 'all'> {
  if (status === 'searching') return 'searching'
  if (status === 'found') return 'found'
  return 'ended'
}

/** Buyer's Bro requests: KPIs, filters and a card per request. Port of the website /bro page. */
export default function BroListScreen() {
  const { t } = useLocale()
  const b = t.bro
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const { ar, dirStyle, rowDir, colDir } = useBroDir()
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')

  const [requests, setRequests] = useState<BroRequest[] | null>(null)
  const [views, setViews] = useState<Record<number, BroRequestView | null>>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [reloadKey, setReloadKey] = useState(0)
  // Only the newest load may write state (a card action can reload while a previous load is still out).
  const seq = useRef(0)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    const ticket = ++seq.current
    try {
      if (!(await isLoggedIn())) {
        router.replace({ pathname: '/(auth)/login', params: { redirect: '/bro' } })
        return
      }
      const list = await listBroRequests()
      if (ticket !== seq.current) return
      // null means the fetch failed: a refresh keeps the last good list.
      if (!list) {
        setFailed(cur => cur || mode === 'initial')
        return
      }
      const sorted = [...list].sort(
        (a, c) => new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime() || c.id - a.id,
      )
      setRequests(sorted)
      setFailed(false)
      setNow(Date.now())
      setLoading(false)
      if (mode === 'refresh') setRefreshing(false)

      // Views are optional per row: a failed one leaves that card without counts or preview.
      const entries = await Promise.all(
        sorted.slice(0, COUNT_ROWS).map(async r => {
          const v = await getBroRequest(r.id).catch(() => null)
          return [r.id, v] as const
        }),
      )
      if (ticket !== seq.current) return
      setViews(Object.fromEntries(entries))
    } catch {
      if (ticket === seq.current && mode === 'initial') setFailed(true)
    } finally {
      if (ticket === seq.current) {
        setLoading(false)
        if (mode === 'refresh') setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load(reloadKey === 0 ? 'initial' : 'refresh')
    return () => {
      seq.current++
    }
  }, [load, reloadKey])

  function retry() {
    setLoading(true)
    setFailed(false)
    void load('initial')
  }

  function onRefresh() {
    setRefreshing(true)
    void load('refresh')
  }

  const statusLabel: Record<BroRequestStatus, string> = {
    searching: b.statusSearching,
    done: b.statusDone,
    expired: b.statusExpired,
    cancelled: b.statusCancelled,
    found: b.statusFound,
  }

  let body: React.ReactNode
  if (loading) {
    body = (
      <View style={{ gap: spacing.sm }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    )
  } else if (failed || !requests) {
    body = (
      <View style={[styles.card, styles.center]}>
        <Text style={[styles.errText, { textAlign: 'center' }]}>{b.errGeneric}</Text>
        <Button label={b.retry} variant="dk" size="sm" onPress={retry} />
      </View>
    )
  } else if (requests.length === 0) {
    const steps = [b.emptyStep1, b.emptyStep2, b.emptyStep3]
    body = (
      <View style={[styles.card, styles.empty]}>
        <Text style={styles.emptyIcon}>🔎</Text>
        <Text style={styles.emptyTitle}>{b.listEmptyTitle}</Text>
        <Text style={styles.emptyBody}>{b.listEmpty}</Text>
        <View style={[styles.steps, rowDir]}>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{fmt(i + 1)}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>
        <Button label={b.emptyCta} variant="y" size="md" fullWidth onPress={() => router.push('/bro/new' as never)} />
      </View>
    )
  } else {
    const tally: Record<Filter, number> = { all: requests.length, searching: 0, found: 0, ended: 0 }
    for (const r of requests) tally[filterOf(r.status)]++
    // Offer total comes from the loaded views, falling back to the list's offerCount for rows past the cap.
    const offerTotal = requests.reduce((sum, r) => {
      const v = views[r.id]
      return sum + (v ? v.offers.filter(o => o.available).length : (r.offerCount ?? 0))
    }, 0)
    // Devices Geeko found across the loaded views; surfaced as a banner instead of a separate entry.
    const foundTotal = Object.values(views).reduce((sum, v) => sum + (v ? v.matches.length : 0), 0)
    const shown = filter === 'all' ? requests : requests.filter(r => filterOf(r.status) === filter)
    const chips: { key: Filter; label: string }[] = [
      { key: 'all', label: b.filterAll },
      { key: 'searching', label: b.filterSearching },
      { key: 'found', label: b.filterFound },
      { key: 'ended', label: b.filterEnded },
    ]

    body = (
      <>
        <View style={[styles.kpis, rowDir]}>
          <Kpi styles={styles} value={fmt(tally.searching)} label={b.kpiSearching} />
          <Kpi styles={styles} value={fmt(offerTotal)} label={b.kpiOffers} accent />
          <Kpi styles={styles} value={fmt(tally.found)} label={b.kpiFound} />
        </View>

        {foundTotal > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/bro-finds' as never)}
            style={({ pressed }) => [styles.banner, rowDir, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.bannerIcon}>✨</Text>
            <Text style={[styles.bannerText, dirStyle]}>{b.foundBanner.replace('{n}', fmt(foundTotal))}</Text>
            <View style={styles.bannerCta}>
              <Text style={styles.bannerCtaText}>{b.foundBannerCta}</Text>
            </View>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={[styles.chips, rowDir]}
        >
          {chips.map(c => {
            const active = filter === c.key
            return (
              <Pressable
                key={c.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(c.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.label} <Text style={{ opacity: 0.7 }}>{fmt(tally[c.key])}</Text>
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {shown.length === 0 ? (
          <Text style={styles.none}>{b.noneInFilter}</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {shown.map(r => (
              <BroRequestRow
                key={r.id}
                request={r}
                statusLabel={statusLabel[r.status]}
                view={views[r.id]}
                now={now}
                onChanged={() => setReloadKey(k => k + 1)}
              />
            ))}
          </View>
        )}
      </>
    )
  }

  return (
    <DashboardLayout title={b.listTitle} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.y]} tintColor={colors.y} />
        }
      >
        <View style={[styles.head, rowDir]}>
          <View style={[styles.headText, colDir]}>
            <Text style={[styles.title, dirStyle]}>{b.listTitle}</Text>
            <Text style={[styles.subtitle, dirStyle]}>{b.listSubtitle}</Text>
          </View>
          {requests && requests.length > 0 ? (
            <Button label={b.newRequest} variant="y" size="sm" onPress={() => router.push('/bro/new' as never)} />
          ) : null}
        </View>
        {body}
      </ScrollView>
    </DashboardLayout>
  )
}

function Kpi({
  styles,
  value,
  label,
  accent,
}: {
  styles: ReturnType<typeof makeStyles>
  value: string
  label: string
  accent?: boolean
}) {
  return (
    <View style={[styles.kpi, accent && styles.kpiAccent]}>
      <Text style={[styles.kpiValue, accent && styles.kpiValueAccent]}>{value}</Text>
      <Text style={[styles.kpiLabel, accent && styles.kpiLabelAccent]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: spacing.md },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
    headText: { flex: 1, minWidth: 0 },
    title: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.heading },
    subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 3 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    center: { alignItems: 'center', gap: spacing.sm },
    errText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
    empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 18 },
    emptyIcon: { fontSize: 40, lineHeight: 48 },
    emptyTitle: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.heading, marginTop: 12, marginBottom: 6, textAlign: 'center' },
    emptyBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 18, textAlign: 'center' },
    steps: { flexDirection: 'row', gap: spacing.sm, marginBottom: 20, alignSelf: 'stretch' },
    step: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, backgroundColor: colors.placeholder, alignItems: 'center' },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: radius.full,
      backgroundColor: colors.y,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    stepNumText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.dk },
    stepText: { fontFamily: fonts.bold, fontSize: 12, color: colors.heading, textAlign: 'center' },
    kpis: { flexDirection: 'row', gap: spacing.sm, marginBottom: 14 },
    kpi: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kpiAccent: { backgroundColor: colors.y, borderColor: colors.y },
    kpiValue: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.heading },
    kpiValueAccent: { color: colors.dk },
    kpiLabel: { fontFamily: fonts.semiBold, fontSize: 11.5, color: colors.muted, marginTop: 3 },
    kpiLabelAccent: { color: colors.dk },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
      borderRadius: 14,
      backgroundColor: isDark ? colors.hero : colors.dk,
    },
    bannerIcon: { fontSize: 20 },
    bannerText: { flex: 1, minWidth: 0, fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
    bannerCta: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.y },
    bannerCtaText: { fontFamily: fonts.extraBold, fontSize: 12.5, color: colors.dk },
    chipsScroll: { flexGrow: 0, marginBottom: 12 },
    chips: { flexDirection: 'row', gap: 6, flexGrow: 1 },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.dk, borderColor: colors.dk },
    chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
    chipTextActive: { color: colors.white },
    none: { textAlign: 'center', fontFamily: fonts.regular, color: colors.muted, fontSize: 14, paddingVertical: 20 },
  })
