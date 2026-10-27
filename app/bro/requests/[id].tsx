import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { broHeader } from '@/components/bro/BroStackHeader'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { apiFetch, type LocationNode } from '@/lib/api'
import {
  cancelBroRequest,
  connectBroInquiry,
  connectBroOffer,
  foundBroRequest,
  getBroRequest,
  rerunBroRequest,
  type BroRequest,
  type BroRequestView,
} from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
import { BroCountPills } from '@/components/bro/BroCountPills'
import { BroMatchCard } from '@/components/bro/BroMatchCard'
import { BroOfferCard } from '@/components/bro/BroOfferCard'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const POLL_MS = 15_000
// Once Geeko is done the request may still sit on the board collecting offers; poll slower.
const BOARD_POLL_MS = 60_000

export default function BroRequestScreen() {
  const { t } = useLocale()
  const styles = useStyles()
  const { id: rawParam } = useLocalSearchParams<{ id: string }>()
  const rawId = Array.isArray(rawParam) ? rawParam[0] : rawParam

  // A non-numeric id is a dead link: show the error state without calling the API.
  if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={broHeader(t.bro.listTitle)} />
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorState title={t.bro.errGeneric} />
        </ScrollView>
      </SafeAreaView>
    )
  }
  // Keyed on id so navigating between requests starts from a clean state.
  return <RequestView key={rawId} id={Number(rawId)} />
}

function RequestView({ id }: { id: number }) {
  const { locale, t } = useLocale()
  const { colors } = useTheme()
  const styles = useStyles()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const [view, setView] = useState<BroRequestView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [pollError, setPollError] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connectingId, setConnectingId] = useState<number | null>(null)
  // Separate from connectingId: offer ids and inquiry ids can collide.
  const [connectingOfferId, setConnectingOfferId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  // Parent of the request's location: undefined while unresolved, null when none (or the lookup failed).
  const [parentLocationId, setParentLocationId] = useState<number | null | undefined>(undefined)
  const inFlight = useRef(false)
  const pollInFlight = useRef(false)
  const seq = useRef(0)

  // Every fetch takes a ticket; only the newest may write the view, so a slow older response is dropped.
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
      const { v, current } = await fetchLatest()
      if (cancelled || !current) return
      setNow(Date.now())
      if (v) {
        setView(v)
        setFailed(false)
        setPollError(false)
      } else {
        // a refresh failure keeps the last good view
        setFailed(cur => cur || view == null)
        setPollError(view != null)
      }
      setLoading(false)
      setRefreshing(false)
    })()
    return () => {
      cancelled = true
    }
    // `view` is read only to decide failure presentation; reloads are driven by reloadKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLatest, reloadKey])

  function retry() {
    setLoading(true)
    setFailed(false)
    setReloadKey(k => k + 1)
  }

  function refresh() {
    setRefreshing(true)
    setReloadKey(k => k + 1)
  }

  // Poll while searching (or still on the board collecting offers) and focused; cleared on blur and unmount.
  const searching = view?.request.status === 'searching'
  const onBoard = view?.onBoard ?? false
  const pollMs = searching ? POLL_MS : onBoard ? BOARD_POLL_MS : 0
  useFocusEffect(
    useCallback(() => {
      if (!pollMs) return
      let cancelled = false
      const timer = setInterval(async () => {
        if (pollInFlight.current) return // skip the tick while the previous fetch is pending
        pollInFlight.current = true
        try {
          const { v, current } = await fetchLatest()
          if (cancelled || !current) return
          if (v) {
            setNow(Date.now())
            setView(v)
            setPollError(false)
          } else {
            setPollError(true) // keep the last good view
          }
        } finally {
          pollInFlight.current = false
        }
      }, pollMs)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [pollMs, fetchLatest]),
  )

  // Resolve the parent location once, so the widen chip is only offered when it can actually widen.
  const locationId = view?.request.locationId ?? null
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    ;(async () => {
      let parent: number | null = null
      try {
        const locs = await apiFetch<LocationNode[]>('/locations')
        if (Array.isArray(locs)) parent = locs.find(l => l.id === locationId)?.parentId ?? null
      } catch {
        // no parent resolved: the chip stays hidden
      }
      if (!cancelled) setParentLocationId(parent)
    })()
    return () => {
      cancelled = true
    }
  }, [locationId])

  // One action at a time (state alone lags a rapid double tap).
  async function run(action: () => Promise<void>, onBusy: (on: boolean) => void): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    onBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : b.errGeneric)
    } finally {
      inFlight.current = false
      onBusy(false)
    }
  }

  // Ends the search with `end`, then reloads the view (shared by cancel and found).
  function endSearch(end: (id: number) => Promise<BroRequest>) {
    void run(async () => {
      await end(id)
      const { v, current } = await fetchLatest()
      if (!current) return // a newer fetch owns the view
      if (v) {
        setNow(Date.now())
        setView(v)
        setPollError(false)
      } else {
        setError(b.errGeneric)
      }
    }, setBusy)
  }

  const stop = () => endSearch(cancelBroRequest)
  const found = () => endSearch(foundBroRequest)

  // Reruns this same request in place, optionally loosening the area or dropping the budget.
  function rerunWith(overrides?: { locationId?: number; clearBudget?: boolean }) {
    void run(async () => {
      await rerunBroRequest(id, overrides)
      const { v, current } = await fetchLatest()
      if (!current) return
      if (v) {
        setNow(Date.now())
        setView(v)
        setPollError(false)
      } else {
        setError(b.errGeneric)
      }
    }, setBusy)
  }

  const rerun = () => rerunWith()
  const widenArea = () => {
    if (parentLocationId != null) rerunWith({ locationId: parentLocationId })
  }
  const dropBudget = () => rerunWith({ clearBudget: true })

  function connect(inquiryId: number) {
    void run(async () => {
      const { conversationId } = await connectBroInquiry(inquiryId)
      router.push(`/dashboard/messages/${conversationId}` as never)
    }, on => setConnectingId(on ? inquiryId : null))
  }

  function connectOffer(offerId: number) {
    void run(async () => {
      const { conversationId } = await connectBroOffer(offerId)
      router.push(`/dashboard/messages/${conversationId}` as never)
    }, on => setConnectingOfferId(on ? offerId : null))
  }

  const header = <Stack.Screen options={broHeader(b.listTitle)} />

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {header}
        <View style={styles.content}>
          <Skeleton height={28} width="60%" />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    )
  }

  if (failed || !view) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorState title={b.errGeneric} retryLabel={b.retry} onRetry={retry} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  const { request, counts, matches, soldCount, offers, offerCount } = view
  const status = request.status
  // A rerun needs the request still live on the board; found/cancelled ones are closed.
  const canRerun = onBoard && (status === 'expired' || status === 'done')
  const canFound = status === 'searching' || status === 'done' || status === 'expired'
  const anyConnecting = busy || connectingId !== null || connectingOfferId !== null
  const firstAvailableOffer = offers.findIndex(o => o.available)
  // Nobody was asked and the run is over, or it expired: offer to loosen the search.
  const showWiden = status === 'expired' || (status !== 'searching' && status !== 'cancelled' && status !== 'found' && counts.asked === 0)
  const untilDate = new Date(request.expiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Cairo',
  })
  const boardUntilDate = new Date(view.boardExpiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Cairo',
  })
  const statusLabel = {
    searching: b.statusSearching,
    done: b.statusDone,
    expired: b.statusExpired,
    cancelled: b.statusCancelled,
    found: b.statusFound,
  }[status]

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.y]} tintColor={colors.y} />}
      >
        <View>
          <Text style={[styles.h1, dirStyle]}>
            {request.modelText}
            {request.storage ? ` · ${request.storage}` : ''}
          </Text>
          <View style={[styles.pill, searching ? styles.pillOn : styles.pillOff, styles.statusPill, { alignSelf: ar ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.pillText, { color: searching ? colors.yellowText : colors.text }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.progress, dirStyle]}>
            {b.askingProgress.replace('{asked}', String(counts.asked)).replace('{available}', String(counts.available))}
          </Text>
          <BroCountPills counts={counts} />
        </View>

        {searching ? (
          <Text style={[styles.until, dirStyle]}>
            {b.searchingUntil.replace('{date}', untilDate)}
            {counts.asked === 0 ? `\n${b.noCandidatesYet}` : ''}
          </Text>
        ) : null}

        {onBoard && !searching ? <Text style={[styles.until, dirStyle]}>{b.stripDone.replace('{date}', boardUntilDate)}</Text> : null}

        {pollError ? <Text style={[styles.errSmall, dirStyle]}>{b.errGeneric}</Text> : null}

        {matches.length > 0 ? (
          <View style={styles.list}>
            <Text style={[styles.h2, dirStyle]}>{b.broFoundSection}</Text>
            {matches.map(m => (
              <BroMatchCard
                key={m.inquiryId}
                match={m}
                busy={connectingId === m.inquiryId}
                disabled={anyConnecting}
                now={now}
                showBroTag
                onConnect={connect}
              />
            ))}
          </View>
        ) : null}

        {offers.length > 0 ? (
          <View style={styles.list}>
            <Text style={[styles.h2, dirStyle]}>{b.offersSection.replace('{n}', String(offerCount))}</Text>
            {offers.map((o, i) => (
              <BroOfferCard
                key={o.offerId}
                offer={o}
                cheapest={i === firstAvailableOffer}
                busy={connectingOfferId === o.offerId}
                disabled={anyConnecting}
                now={now}
                onConnect={connectOffer}
              />
            ))}
          </View>
        ) : null}

        {matches.length === 0 && offers.length === 0 && !searching ? (
          <View style={[styles.card, styles.centerCard]}>
            <Text style={[styles.emptyTitle, dirStyle]}>{b.emptyTitle}</Text>
          </View>
        ) : null}

        {showWiden && canRerun ? (
          <View style={[styles.chips, rowDir]}>
            {parentLocationId != null ? (
              <BroButton label={b.widenArea} disabled={busy} onPress={widenArea} dirStyle={dirStyle} />
            ) : null}
            <BroButton label={b.dropBudget} disabled={busy} onPress={dropBudget} dirStyle={dirStyle} />
          </View>
        ) : null}

        {/* The API returns only a count for sold listings; they stay hidden. */}
        {soldCount > 0 ? <Text style={[styles.sold, dirStyle]}>{`${b.sectionSold} (${soldCount})`}</Text> : null}

        {error ? <Text style={[styles.err, dirStyle]}>{error}</Text> : null}

        <View style={[styles.chips, rowDir]}>
          {searching ? <Button label={b.stopSearch} variant="outline" size="md" disabled={busy} onPress={stop} /> : null}
          {canFound ? <Button label={b.foundButton} variant="dk" size="md" disabled={busy} onPress={found} /> : null}
          {canRerun ? <Button label={b.rerun} variant="dk" size="md" disabled={busy} onPress={rerun} /> : null}
          {/* A way out of a finished request: the buyer can't open another action here, so send them shopping. */}
          <Button label={b.browseProducts} variant="outline" size="md" onPress={() => router.push('/(tabs)/products' as never)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  h1: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.heading },
  h2: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
    ...(dark ? null : shadow.ss),
  },
  centerCard: { alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.heading },
  progress: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.heading },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillOn: { backgroundColor: colors.yellowBg },
  pillOff: { backgroundColor: colors.placeholder },
  statusPill: { marginTop: 6 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  list: { gap: 10 },
  sold: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  until: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  errSmall: { fontFamily: fonts.regular, fontSize: 12, color: colors.red },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
