import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { connectBroOffer, getBroRequest, type BroRequestView } from '@/lib/bro'
import { BroOfferCard } from '@/components/bro/BroOfferCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

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
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
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
  // Offers arrive sorted available-first, then cheapest: the first available one is the cheapest.
  const cheapestIndex = offers.findIndex(o => o.available)

  return (
    <DashboardLayout title={b.offersPageTitle} scroll={false} contentPadding={false}>
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
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
    </DashboardLayout>
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
})
