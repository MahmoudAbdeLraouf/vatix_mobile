import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { connectBroOffer, foundBroRequest, getBroRequest, markBroRequestSeen, type BroOfferView, type BroRequestView } from '@/lib/bro'
import { BroOfferCard } from '@/components/bro/BroOfferCard'
import { useBroDir } from '@/components/bro/BroCardParts'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

type Sort = 'cheapest' | 'newest'

const isVerified = (o: BroOfferView) => !!o.seller.storeVerified || (o.seller.verificationChecks?.length ?? 0) > 0

/** All seller offers on one request, each with a chat button. Port of the website /bro/requests/[id]/offers. */
export default function BroRequestOffersScreen() {
  const { t } = useLocale()
  const { id: rawParam } = useLocalSearchParams<{ id: string }>()
  const rawId = Array.isArray(rawParam) ? rawParam[0] : rawParam

  // A non-numeric id is a dead link: show the error state without calling the API.
  if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
    return (
      <DashboardLayout title={t.bro.offersPageTitle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState title={t.bro.errGeneric} />
      </DashboardLayout>
    )
  }
  return <OffersView key={rawId} id={Number(rawId)} />
}

function OffersView({ id }: { id: number }) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const { dirStyle, rowDir } = useBroDir()
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const [view, setView] = useState<BroRequestView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [connectingOfferId, setConnectingOfferId] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [sort, setSort] = useState<Sort>('cheapest')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [storesOnly, setStoresOnly] = useState(false)
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [finding, setFinding] = useState(false)
  const inFlight = useRef(false)
  const seq = useRef(0)

  // Every fetch takes a ticket; only the newest may write the view.
  const fetchLatest = useCallback(async () => {
    const ticket = ++seq.current
    let v: BroRequestView | null = null
    try {
      v = await getBroRequest(id)
    } catch {
      v = null
    }
    return { v, current: ticket === seq.current }
  }, [id])

  // The single load path (initial load, retry and pull-to-refresh via reloadKey).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!(await isLoggedIn())) {
        router.replace({ pathname: '/(auth)/login', params: { redirect: `/bro/request-offers/${id}` } })
        return
      }
      const { v, current } = await fetchLatest()
      if (cancelled || !current) return
      setNow(Date.now())
      if (v) {
        setView(v)
        setFailed(false)
        void markBroRequestSeen(v.request.id).catch(() => {})
      } else {
        // a refresh failure keeps the last good view
        setFailed(cur => cur || view == null)
      }
      setLoading(false)
      setRefreshing(false)
    })()
    return () => {
      cancelled = true
    }
    // `view` is read only to decide failure presentation; reloads are driven by reloadKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLatest, reloadKey, id])

  function retry() {
    setLoading(true)
    setFailed(false)
    setReloadKey(k => k + 1)
  }

  function refresh() {
    setRefreshing(true)
    setReloadKey(k => k + 1)
  }

  // One connect at a time (state alone lags a rapid double tap).
  async function connectOffer(offerId: number) {
    if (inFlight.current) return
    inFlight.current = true
    setConnectingOfferId(offerId)
    setError('')
    try {
      const { conversationId } = await connectBroOffer(offerId)
      router.push(`/dashboard/messages/${conversationId}` as never)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : b.errGeneric)
    } finally {
      inFlight.current = false
      setConnectingOfferId(null)
    }
  }

  // Closing the request: confirm first, then reload so the status (and the found bar) update.
  function markFound() {
    if (inFlight.current) return
    Alert.alert(b.foundConfirm, undefined, [
      { text: t.cancel, style: 'cancel' },
      {
        text: b.foundBarBtn,
        onPress: async () => {
          if (inFlight.current) return
          inFlight.current = true
          setFinding(true)
          setError('')
          try {
            await foundBroRequest(id)
            setReloadKey(k => k + 1)
          } catch (err) {
            setError(err instanceof Error && err.message ? err.message : b.errGeneric)
          } finally {
            inFlight.current = false
            setFinding(false)
          }
        },
      },
    ])
  }

  const header = <Stack.Screen options={{ headerShown: false }} />

  if (loading) {
    return (
      <DashboardLayout title={b.offersPageTitle}>
        {header}
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </DashboardLayout>
    )
  }

  if (failed || !view) {
    return (
      <DashboardLayout title={b.offersPageTitle}>
        {header}
        <ErrorState title={b.errGeneric} retryLabel={b.retry} onRetry={retry} />
      </DashboardLayout>
    )
  }

  const r = view.request
  const offers = view.offers
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')
  const egp = (n: number) => b.priceEgp.replace('{price}', fmt(n))
  const budgetMax = r.budgetMax == null || r.budgetMax === '' ? null : Number(r.budgetMax)
  const available = offers.filter(o => o.available)
  const unavailable = offers.filter(o => !o.available)
  const prices = available.map(o => Number(o.price))
  const cheapestPrice = prices.length ? Math.min(...prices) : null
  const average = prices.length ? Math.round(prices.reduce((a, p) => a + p, 0) / prices.length) : null
  const cheapestId =
    cheapestPrice == null ? null : available.reduce<BroOfferView | null>((best, o) => (best == null || Number(o.price) < Number(best.price) ? o : best), null)?.offerId ?? null
  const shown = available
    .filter(o => (!verifiedOnly || isVerified(o)) && (!storesOnly || o.seller.type === 'store'))
    .sort((a, c) =>
      sort === 'cheapest'
        ? Number(a.price) - Number(c.price) || a.offerId - c.offerId
        : new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime() || c.offerId - a.offerId,
    )
  const canFound = r.status === 'searching' || r.status === 'done' || r.status === 'expired'
  const busyAny = connectingOfferId !== null || finding

  const card = (o: BroOfferView, i: number) => (
    <BroOfferCard
      key={o.offerId}
      offer={o}
      cheapest={o.offerId === cheapestId}
      emphasized={i === 0 && sort === 'cheapest' && o.offerId === cheapestId}
      budgetMax={budgetMax}
      now={now}
      busy={connectingOfferId === o.offerId}
      disabled={busyAny && connectingOfferId !== o.offerId}
      onConnect={connectOffer}
    />
  )

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )

  return (
    <DashboardLayout title={b.offersPageTitle} scroll={false} contentPadding={false}>
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.y]} tintColor={colors.y} />}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/bro/requests/${id}` as never)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.kicker, dirStyle]}>{b.offersPageTitle}</Text>
          <Text style={[styles.title, dirStyle]}>
            {r.modelText}
            {r.storage ? ` · ${r.storage}` : ''}
          </Text>
          <Text style={[styles.back, dirStyle]}>{b.backToRequest}</Text>
        </Pressable>

        {offers.length === 0 ? (
          <View style={[styles.card, styles.waiting]}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={[styles.waitingTitle, styles.center]}>{b.waitingTitle}</Text>
            <Text style={[styles.waitingBody, styles.center]}>
              {view.counts.asked > 0 ? b.waitingBody.replace('{n}', fmt(view.counts.asked)) : b.noOffersYet}
            </Text>
          </View>
        ) : null}

        {available.length > 0 ? (
          <>
            <View style={[styles.card, styles.stats, rowDir]}>
              <Stat styles={styles} label={b.statCheapest} value={cheapestPrice == null ? '—' : egp(cheapestPrice)} strong />
              <View style={styles.divider} />
              <Stat styles={styles} label={b.statAverage} value={average == null ? '—' : egp(average)} />
              <View style={styles.divider} />
              <Stat styles={styles} label={b.statBudget} value={budgetMax == null ? b.budgetNone : egp(budgetMax)} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, rowDir]}>
              {chip(b.sortCheapestOpt, sort === 'cheapest', () => setSort('cheapest'))}
              {chip(b.sortNewestOpt, sort === 'newest', () => setSort('newest'))}
              {chip(b.filterVerified, verifiedOnly, () => setVerifiedOnly(v => !v))}
              {chip(b.filterStores, storesOnly, () => setStoresOnly(v => !v))}
            </ScrollView>

            <Text style={[styles.h2, dirStyle]}>{b.offersAvailableN.replace('{n}', fmt(shown.length))}</Text>
            {shown.length === 0 ? (
              <View style={styles.card}>
                <EmptyState title={b.noneInFilter} />
              </View>
            ) : (
              <View style={styles.list}>{shown.map(card)}</View>
            )}
          </>
        ) : null}

        {unavailable.length > 0 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showUnavailable }}
              onPress={() => setShowUnavailable(v => !v)}
              style={[styles.toggle, rowDir]}
            >
              <Text style={styles.toggleText}>{b.unavailableSection.replace('{n}', fmt(unavailable.length))}</Text>
              <Text style={styles.toggleText}>{showUnavailable ? '▲' : '▼'}</Text>
            </Pressable>
            {showUnavailable ? <View style={styles.list}>{unavailable.map(card)}</View> : null}
          </>
        ) : null}

        {error ? <Text style={[styles.err, dirStyle]}>{error}</Text> : null}
      </ScrollView>

      {canFound ? (
        <View style={[styles.foundBar, rowDir, { marginBottom: insets.bottom + spacing.sm }]}>
          <Text style={[styles.foundTitle, dirStyle]} numberOfLines={2}>
            {b.foundBarTitle}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busyAny}
            onPress={markFound}
            style={({ pressed }) => [styles.foundBtn, (pressed || busyAny) && { opacity: 0.7 }]}
          >
            <Text style={styles.foundBtnText}>{b.foundBarBtn}</Text>
          </Pressable>
        </View>
      ) : null}
    </DashboardLayout>
  )
}

function Stat({ styles, label, value, strong = false }: { styles: ReturnType<typeof makeStyles>; label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, strong && styles.statStrong]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    ...(dark ? null : shadow.ss),
  },
  kicker: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  title: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.heading },
  back: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, marginTop: 4 },
  h2: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading },
  list: { gap: 10 },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  center: { textAlign: 'center' },
  waiting: { alignItems: 'center', paddingVertical: spacing.lg, gap: 6 },
  waitingIcon: { fontSize: 32 },
  waitingTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.heading },
  waitingBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 20 },
  stats: { alignItems: 'stretch', paddingVertical: 12, paddingHorizontal: 4 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  statValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.heading },
  statStrong: { fontFamily: fonts.extraBold, color: dark ? colors.green : '#1a7f3c' },
  divider: { width: 1, backgroundColor: colors.border },
  chips: { gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: dark ? colors.y : '#062B5B', borderColor: dark ? colors.y : '#062B5B' },
  chipText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  chipTextOn: { color: dark ? '#062B5B' : '#FFFFFF' },
  toggle: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  toggleText: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  foundBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: '#062B5B',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  foundTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  foundBtn: { backgroundColor: colors.y, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 16 },
  foundBtnText: { fontFamily: fonts.extraBold, fontSize: 13, color: '#062B5B' },
})
