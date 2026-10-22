import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { getBroRequest, listBroRequests, type BroRequest, type BroRequestStatus, type BroRequestView } from '@/lib/bro'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { BroCountPills } from '@/components/bro/BroCountPills'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

// Per-row counts cost one request each, so only the newest rows get them.
const COUNT_ROWS = 20

type Counts = BroRequestView['counts']

/** Buyer's Bro requests, newest first. Port of the website /bro page. */
export default function BroListScreen() {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const [requests, setRequests] = useState<BroRequest[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState<Record<number, Counts>>({})
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
      // Counts are decoration: a failed row simply shows no pills.
      sorted.slice(0, COUNT_ROWS).forEach(r => {
        getBroRequest(r.id)
          .then(v => {
            if (v && ticket === seq.current) setCounts(cur => ({ ...cur, [r.id]: v.counts }))
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
    body = <ErrorState title={b.errGeneric} retryLabel={b.retry} onRetry={retry} />
  } else if (requests.length === 0) {
    body = <EmptyState title={b.listEmpty} actionLabel={b.newRequest} onAction={() => router.push('/bro/new' as never)} />
  } else {
    body = (
      <View style={{ gap: spacing.sm }}>
        {requests.map(r => {
          const c = counts[r.id]
          const searching = r.status === 'searching'
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push(`/bro/requests/${r.id}` as never)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.rowTop, rowDir]}>
                <Text style={[styles.rowTitle, dirStyle]} numberOfLines={2}>
                  {r.modelText}
                  {r.storage ? ` · ${r.storage}` : ''}
                </Text>
                <View style={[styles.pill, searching ? styles.pillSearching : styles.pillIdle]}>
                  <Text style={[styles.pillText, { color: searching ? colors.yt : colors.g700 }]}>
                    {statusLabel[r.status]}
                  </Text>
                </View>
              </View>
              <Text style={[styles.date, dirStyle]}>
                {new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-EG')}
              </Text>
              {c ? (
                <View style={styles.countRow}>
                  <BroCountPills counts={c} />
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: b.listTitle }} />
      <ScrollView
        contentContainerStyle={styles.content}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  head: { marginBottom: spacing.md },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.ss,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.dk },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillSearching: { backgroundColor: colors.yl },
  pillIdle: { backgroundColor: colors.g100 },
  pillText: { fontFamily: fonts.bold, fontSize: 11 },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500 },
  countRow: { marginTop: 4 },
})
