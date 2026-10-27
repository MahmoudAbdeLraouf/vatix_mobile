import { useCallback, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { getBroRequest, listBroRequests, type BroRequest } from '@/lib/bro'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { BroRequestRow } from '@/components/bro/BroRequestRow'
import { fonts, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const SHOWN = 3

/** Dashboard "My requests": the latest requests, each with an Offers button. Port of the website DashboardBroRequests. */
export function DashboardBroRequests() {
  const { locale, t } = useLocale()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const b = t.bro
  const ar = locale === 'ar'
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const [requests, setRequests] = useState<BroRequest[] | null>(null)
  const [offerCounts, setOfferCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  const requestsRef = useRef<BroRequest[] | null>(null)
  requestsRef.current = requests

  const load = useCallback(async () => {
    const ticket = ++seq.current
    let list: BroRequest[] | null = null
    try {
      list = await listBroRequests()
    } catch {
      list = null
    }
    if (ticket !== seq.current) return
    const latest = list
      ? [...list]
          .sort((a, c) => new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime() || c.id - a.id)
          .slice(0, SHOWN)
      : null
    // A failed refresh keeps the last good list.
    if (latest) setRequests(latest)
    setFailed(cur => (latest ? false : cur || requestsRef.current == null))
    setLoading(false)
    // The list endpoint may omit offer counts, so read them per shown request.
    latest?.forEach(r => {
      getBroRequest(r.id)
        .then(v => {
          if (v && ticket === seq.current) setOfferCounts(m => ({ ...m, [r.id]: v.offers.length }))
        })
        .catch(() => undefined)
    })
  }, [])

  // Reload on every focus so a new request or offer shows when coming back to the dashboard.
  useFocusEffect(
    useCallback(() => {
      void load()
      return () => {
        seq.current++
      }
    }, [load]),
  )

  function retry() {
    setLoading(true)
    setFailed(false)
    void load()
  }

  let body: React.ReactNode
  if (loading) {
    body = (
      <View style={styles.list}>
        <SkeletonRow />
        <SkeletonRow />
      </View>
    )
  } else if (failed || !requests) {
    body = <ErrorState title={b.errGeneric} retryLabel={b.retry} onRetry={retry} />
  } else if (requests.length === 0) {
    body = <EmptyState title={b.listEmpty} />
  } else {
    body = (
      <View style={styles.list}>
        {requests.map(r => (
          <BroRequestRow key={r.id} request={r} offerCount={offerCounts[r.id] ?? r.offerCount ?? null} />
        ))}
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <View style={[styles.head, rowDir]}>
        <Text style={styles.title}>{b.listTitle}</Text>
        <View style={[styles.actions, rowDir]}>
          <Button label={b.newRequest} variant="outline" size="sm" onPress={() => router.push('/bro/new' as never)} />
          <Button label={b.seeAll} variant="dk" size="sm" onPress={() => router.push('/bro' as never)} />
        </View>
      </View>
      {body}
    </View>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginBottom: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 16, color: colors.heading },
  actions: { flexDirection: 'row', gap: spacing.xs },
  list: { gap: spacing.sm },
})
