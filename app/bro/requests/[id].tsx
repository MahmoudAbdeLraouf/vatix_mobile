import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { apiFetch, imgUrl, type LocationNode } from '@/lib/api'
import {
  cancelBroRequest,
  connectBroInquiry,
  foundBroRequest,
  getBroRequest,
  rerunBroRequest,
  type BroMatchView,
  type BroRequest,
  type BroRequestView,
  type BroScratches,
} from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const POLL_MS = 15_000

type PrefillParams = Record<string, string>

/** Params for /bro/new carrying the request's own values, in the format the intake parses. */
function prefillParams(r: BroRequest, opts: { locationId?: number | null; withBudget: boolean }): PrefillParams {
  const q: PrefillParams = { categoryId: String(r.categoryId) }
  if (r.brandId) q.brandId = String(r.brandId)
  if (r.modelText) q.model = r.modelText
  if (r.storage) q.storage = r.storage
  if (r.wants.length > 0) q.wants = r.wants.join(',')
  if (opts.withBudget && r.budgetMax != null && Number(r.budgetMax) > 0) q.budgetMax = String(Number(r.budgetMax))
  if (opts.locationId) q.locationId = String(opts.locationId)
  return q
}

export default function BroRequestScreen() {
  const { t } = useLocale()
  const { id: rawParam } = useLocalSearchParams<{ id: string }>()
  const rawId = Array.isArray(rawParam) ? rawParam[0] : rawParam

  // A non-numeric id is a dead link: show the error state without calling the API.
  if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: t.bro.listTitle }} />
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorState title={t.bro.errGeneric} />
        </ScrollView>
      </SafeAreaView>
    )
  }
  // Keyed on id so a rerun (same route, new id) starts from a clean state.
  return <RequestView key={rawId} id={Number(rawId)} />
}

function RequestView({ id }: { id: number }) {
  const { locale, t } = useLocale()
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

  // Poll only while searching and focused; cleared on blur and unmount.
  const searching = view?.request.status === 'searching'
  useFocusEffect(
    useCallback(() => {
      if (!searching) return
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
      }, POLL_MS)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [searching, fetchLatest]),
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

  function rerun() {
    void run(async () => {
      const result = await rerunBroRequest(id)
      router.push(`/bro/requests/${result.request.id}` as never)
    }, setBusy)
  }

  function connect(inquiryId: number) {
    void run(async () => {
      const { conversationId } = await connectBroInquiry(inquiryId)
      router.push(`/dashboard/messages/${conversationId}` as never)
    }, on => setConnectingId(on ? inquiryId : null))
  }

  function widenArea(r: BroRequest) {
    void run(async () => {
      router.push({ pathname: '/bro/new', params: prefillParams(r, { locationId: parentLocationId, withBudget: true }) } as never)
    }, setBusy)
  }

  function dropBudget(r: BroRequest) {
    void run(async () => {
      router.push({ pathname: '/bro/new', params: prefillParams(r, { locationId: r.locationId, withBudget: false }) } as never)
    }, setBusy)
  }

  const header = <Stack.Screen options={{ headerShown: true, title: b.listTitle }} />

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

  const { request, counts, matches, soldCount } = view
  const status = request.status
  const canRerun = status === 'expired' || status === 'done'
  // Nobody was asked and the run is over, or it expired: offer to loosen the search.
  const showWiden = status === 'expired' || (status !== 'searching' && status !== 'cancelled' && status !== 'found' && counts.asked === 0)
  const untilDate = new Date(request.expiresAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
    weekday: 'long',
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
            <Text style={[styles.pillText, { color: searching ? '#8a6500' : colors.g700 }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.progress, dirStyle]}>
            {b.askingProgress.replace('{asked}', String(counts.asked)).replace('{available}', String(counts.available))}
          </Text>
          <View style={[styles.chips, rowDir]}>
            <View style={[styles.pill, styles.pillOn]}>
              <Text style={styles.pillTextDark}>
                {b.pillAvailable} {counts.available}
              </Text>
            </View>
            <View style={[styles.pill, styles.pillOff]}>
              <Text style={styles.pillTextDark}>
                {b.pillSold} {counts.sold}
              </Text>
            </View>
            <View style={[styles.pill, styles.pillOff]}>
              <Text style={styles.pillTextDark}>
                {b.pillPending} {counts.pending}
              </Text>
            </View>
          </View>
        </View>

        {searching ? (
          <Text style={[styles.until, dirStyle]}>
            {b.searchingUntil.replace('{date}', untilDate)}
            {counts.asked === 0 ? `\n${b.noCandidatesYet}` : ''}
          </Text>
        ) : null}

        {pollError ? <Text style={[styles.errSmall, dirStyle]}>{b.errGeneric}</Text> : null}

        {matches.length > 0 ? (
          <View style={styles.list}>
            <Text style={[styles.h2, dirStyle]}>{b.sectionAvailable}</Text>
            {matches.map(m => (
              <MatchCard key={m.inquiryId} match={m} busy={connectingId === m.inquiryId} now={now} onConnect={connect} />
            ))}
          </View>
        ) : !searching ? (
          <View style={[styles.card, styles.centerCard]}>
            <Text style={[styles.emptyTitle, dirStyle]}>{b.emptyTitle}</Text>
          </View>
        ) : null}

        {showWiden ? (
          <View style={[styles.chips, rowDir]}>
            {parentLocationId != null ? (
              <BroButton label={b.widenArea} disabled={busy} onPress={() => widenArea(request)} dirStyle={dirStyle} />
            ) : null}
            <BroButton label={b.dropBudget} disabled={busy} onPress={() => dropBudget(request)} dirStyle={dirStyle} />
          </View>
        ) : null}

        {/* The API returns only a count for sold listings; they stay hidden. */}
        {soldCount > 0 ? <Text style={[styles.sold, dirStyle]}>{`${b.sectionSold} (${soldCount})`}</Text> : null}

        {error ? <Text style={[styles.err, dirStyle]}>{error}</Text> : null}

        <View style={[styles.chips, rowDir]}>
          {searching ? <Button label={b.stopSearch} variant="outline" size="md" disabled={busy} onPress={stop} /> : null}
          {searching ? <Button label={b.foundButton} variant="dk" size="md" disabled={busy} onPress={found} /> : null}
          {canRerun ? <Button label={b.rerun} variant="dk" size="md" disabled={busy} onPress={rerun} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/** One seller-confirmed match. The parent owns the connect call and its in-flight guard. */
function MatchCard({
  match,
  busy,
  now,
  onConnect,
}: {
  match: BroMatchView
  busy: boolean
  now: number
  onConnect: (inquiryId: number) => void
}) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null
  const { product } = match

  const scratchLabel: Record<BroScratches, string> = {
    none: b.scratchesNone,
    minor: b.scratchesMinor,
    repaired: b.scratchesRepaired,
  }

  function ago(iso: string): string {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
    if (!Number.isFinite(mins) || mins < 1) return b.agoNow
    if (mins < 60) return b.agoMinutes.replace('{n}', String(mins))
    const hours = Math.floor(mins / 60)
    if (hours < 24) return b.agoHours.replace('{n}', String(hours))
    return b.agoDays.replace('{n}', String(Math.floor(hours / 24)))
  }

  const price = match.latestPrice ?? product.price
  const image = imgUrl(product.image, { w: 144 })
  const area = match.checkArea ?? product.locationName
  const facts: string[] = [
    area ? `📍 ${b.factArea.replace('{area}', area)}` : '',
    match.scratches ? `🔍 ${scratchLabel[match.scratches]}` : '',
    match.hasBox ? `📦 ${b.extraBox}` : '',
    match.hasInvoice ? `🧾 ${b.extraInvoice}` : '',
    match.hasWarranty
      ? `🛡️ ${match.warrantyNote ? b.factWarranty.replace('{note}', match.warrantyNote) : b.extraWarranty}`
      : '',
  ].filter(Boolean)

  return (
    <View style={styles.card}>
      {match.isCheapest ? (
        <View style={[styles.ribbon, { alignSelf: ar ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.ribbonText}>{b.cheapestRibbon}</Text>
        </View>
      ) : null}

      <View style={[styles.matchTop, rowDir]}>
        <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={styles.thumbImg} /> : null}</View>
        <View style={styles.matchInfo}>
          <Text style={[styles.matchTitle, dirStyle]}>{product.title}</Text>
          <View style={[styles.priceRow, rowDir]}>
            <Text style={styles.price}>{b.priceEgp.replace('{price}', price.toLocaleString())}</Text>
            {match.priceDrop != null && match.priceDrop > 0 ? (
              <View style={[styles.pill, styles.pillOn]}>
                <Text style={[styles.pillText, { color: '#8a6500' }]}>
                  {b.priceDrop.replace('{amount}', match.priceDrop.toLocaleString())}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.seller, dirStyle]}>
            {match.seller.displayName} · {b.factAvailable.replace('{ago}', ago(match.answeredAt))}
          </Text>
        </View>
      </View>

      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map(f => (
            <Text key={f} style={[styles.fact, dirStyle]}>
              {f}
            </Text>
          ))}
        </View>
      ) : null}

      {match.sellerNote ? (
        <Text style={[styles.note, dirStyle]}>{b.sellerQuote.replace('{note}', match.sellerNote)}</Text>
      ) : null}

      <View style={[styles.chips, rowDir]}>
        <BroButton
          label={busy ? b.connecting : b.chatSeller}
          variant="dark"
          disabled={busy}
          onPress={() => onConnect(match.inquiryId)}
          dirStyle={dirStyle}
        />
        <BroButton label={b.viewAd} onPress={() => router.push(`/products/${product.id}` as never)} dirStyle={dirStyle} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  h1: { fontFamily: fonts.extraBold, fontSize: 20, color: '#1A2540' },
  h2: { fontFamily: fonts.extraBold, fontSize: 15, color: '#1A2540' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: 10,
    ...shadow.ss,
  },
  centerCard: { alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.extraBold, fontSize: 14, color: '#1A2540' },
  progress: { fontFamily: fonts.extraBold, fontSize: 14, color: '#1A2540' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillOn: { backgroundColor: '#fff8e1' },
  pillOff: { backgroundColor: colors.g100 },
  statusPill: { marginTop: 6 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  pillTextDark: { fontFamily: fonts.bold, fontSize: 12, color: '#1A2540' },
  list: { gap: 10 },
  sold: { fontFamily: fonts.regular, fontSize: 13, color: colors.g500 },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  until: { fontFamily: fonts.regular, fontSize: 13, color: colors.g700 },
  errSmall: { fontFamily: fonts.regular, fontSize: 12, color: colors.red },
  ribbon: { backgroundColor: '#F5B800', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  ribbonText: { fontFamily: fonts.extraBold, fontSize: 12, color: '#1A2540' },
  matchTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.g100 },
  thumbImg: { width: 72, height: 72 },
  matchInfo: { flex: 1, minWidth: 0 },
  matchTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#1A2540' },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  price: { fontFamily: fonts.extraBold, fontSize: 16, color: '#1A2540' },
  seller: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500, marginTop: 2 },
  facts: { gap: 4 },
  fact: { fontFamily: fonts.regular, fontSize: 13, color: colors.g700 },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g700,
    backgroundColor: colors.g100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
})
