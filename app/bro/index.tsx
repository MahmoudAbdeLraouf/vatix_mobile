import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { getBroRequest, listBroRequests, type BroRequest, type BroRequestView } from '@/lib/bro'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { BroRequestRow } from '@/components/bro/BroRequestRow'
import { colors, spacing } from '@/constants/theme'

// Per-row counts (pills + offer count) cost one request each, so only the newest rows get them.
const COUNT_ROWS = 20

type Counts = BroRequestView['counts']

/** Buyer's Bro requests, newest first. Port of the website /bro page. */
export default function BroListScreen() {
  const { t } = useLocale()
  const b = t.bro
  const insets = useSafeAreaInsets()

  const [requests, setRequests] = useState<BroRequest[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState<Record<number, Counts>>({})
  const [offerCounts, setOfferCounts] = useState<Record<number, number>>({})
  const [reloadKey, setReloadKey] = useState(0)
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
      if (!list) {
        setFailed(true)
        return
      }
      const sorted = [...list].sort(
        (a, c) => new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime() || c.id - a.id,
      )
      setRequests(sorted)
      setFailed(false)
      setCounts({})
      setOfferCounts({})
      // Counts are decoration: a failed row simply shows no pills.
      sorted.slice(0, COUNT_ROWS).forEach(r => {
        getBroRequest(r.id)
          .then(v => {
            if (!v || ticket !== seq.current) return
            setCounts(cur => ({ ...cur, [r.id]: v.counts }))
            setOfferCounts(cur => ({ ...cur, [r.id]: v.offers.length }))
          })
          .catch(() => undefined)
      })
    } catch {
      if (ticket === seq.current) setFailed(true)
    } finally {
      if (ticket === seq.current) {
        setLoading(false)
        if (mode === 'refresh') setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load('initial')
    return () => {
      seq.current++
    }
  }, [load, reloadKey])

  function retry() {
    setLoading(true)
    setFailed(false)
    setReloadKey(k => k + 1)
  }

  function onRefresh() {
    setRefreshing(true)
    void load('refresh')
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
    body = <ErrorState title={b.errGeneric} retryLabel={b.retry} onRetry={retry} />
  } else if (requests.length === 0) {
    body = <EmptyState title={b.listEmpty} actionLabel={b.newRequest} onAction={() => router.push('/bro/new' as never)} />
  } else {
    body = (
      <View style={{ gap: spacing.sm }}>
        {requests.map(r => (
          <BroRequestRow
            key={r.id}
            request={r}
            counts={counts[r.id]}
            offerCount={offerCounts[r.id] ?? r.offerCount ?? null}
          />
        ))}
      </View>
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
        {!loading && !failed && requests && requests.length > 0 ? (
          <View style={styles.head}>
            <Button label={b.newRequest} variant="dk" size="md" onPress={() => router.push('/bro/new' as never)} />
          </View>
        ) : null}
        {body}
      </ScrollView>
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.md },
  head: { marginBottom: spacing.md },
})
