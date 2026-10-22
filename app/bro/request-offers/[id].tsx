import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { broHeader } from '@/components/bro/BroStackHeader'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { connectBroOffer, getBroRequest, type BroRequestView } from '@/lib/bro'
import { BroOfferCard } from '@/components/bro/BroOfferCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

/** All seller offers on one request, each with a chat button. Port of the website /bro/requests/[id]/offers. */
export default function BroRequestOffersScreen() {
  const { t } = useLocale()
  const { id: rawParam } = useLocalSearchParams<{ id: string }>()
  const rawId = Array.isArray(rawParam) ? rawParam[0] : rawParam

  // A non-numeric id is a dead link: show the error state without calling the API.
  if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={broHeader(t.bro.offersPageTitle)} />
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorState title={t.bro.errGeneric} />
        </ScrollView>
      </SafeAreaView>
    )
  }
  return <OffersView key={rawId} id={Number(rawId)} />
}

function OffersView({ id }: { id: number }) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }

  const [view, setView] = useState<BroRequestView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [connectingOfferId, setConnectingOfferId] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
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

  const header = <Stack.Screen options={broHeader(b.offersPageTitle)} />

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {header}
        <View style={styles.content}>
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

  const r = view.request
  const offers = view.offers
  // Offers arrive sorted available-first, then cheapest: the first available one is the cheapest.
  const cheapestIndex = offers.findIndex(o => o.available)

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
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

        <Text style={[styles.h2, dirStyle]}>{b.offersSection.replace('{n}', offers.length.toLocaleString(ar ? 'ar-EG' : 'en-EG'))}</Text>

        {offers.length === 0 ? (
          <View style={styles.card}>
            <EmptyState title={b.noOffersYet} />
          </View>
        ) : (
          <View style={styles.list}>
            {offers.map((o, i) => (
              <BroOfferCard
                key={o.offerId}
                offer={o}
                cheapest={i === cheapestIndex}
                now={now}
                busy={connectingOfferId === o.offerId}
                disabled={connectingOfferId !== null && connectingOfferId !== o.offerId}
                onConnect={connectOffer}
              />
            ))}
          </View>
        )}

        {error ? <Text style={[styles.err, dirStyle]}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: 4,
    ...shadow.ss,
  },
  kicker: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500 },
  title: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.dk },
  back: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.g700, marginTop: 4 },
  h2: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.dk },
  list: { gap: 10 },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
})
