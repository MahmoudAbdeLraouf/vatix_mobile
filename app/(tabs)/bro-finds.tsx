import { useCallback, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { connectBroInquiry, getBroRequest, listBroRequests, type BroRequestView } from '@/lib/bro'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { BroMatchCard } from '@/components/bro/BroMatchCard'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { colors, fonts, spacing } from '@/constants/theme'

// Each request's matches cost one call, so only the newest requests are scanned.
const SCAN_ROWS = 20

/** Every device Bro found, across the buyer's requests, grouped by request (newest first). */
export default function BroFindsTab() {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const [groups, setGroups] = useState<BroRequestView[] | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [connectingId, setConnectingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const seq = useRef(0)
  const inFlight = useRef(false)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    const ticket = ++seq.current
    try {
      if (!(await isLoggedIn())) {
        if (ticket === seq.current) setLoggedIn(false)
        return
      }
      setLoggedIn(true)
      const list = await listBroRequests()
      if (ticket !== seq.current) return
      if (!list) {
        setFailed(true)
        return
      }
      const newest = [...list]
        .sort((a, c) => new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime() || c.id - a.id)
        .slice(0, SCAN_ROWS)
      const views = await Promise.all(newest.map(r => getBroRequest(r.id).catch(() => null)))
      if (ticket !== seq.current) return
      // Every lookup failing is an outage, not "nothing found".
      if (newest.length > 0 && views.every(v => !v)) {
        setFailed(true)
        return
      }
      setGroups(views.filter((v): v is BroRequestView => !!v && v.matches.length > 0))
      setNow(Date.now())
      setFailed(false)
    } catch {
      if (ticket === seq.current) setFailed(true)
    } finally {
      if (ticket === seq.current) {
        setLoading(false)
        if (mode === 'refresh') setRefreshing(false)
      }
    }
  }, [])

  // Reload on every visit so new finds show up without a pull.
  useFocusEffect(
    useCallback(() => {
      void load('initial')
      return () => {
        seq.current++
      }
    }, [load]),
  )

  function retry() {
    setLoading(true)
    setFailed(false)
    void load('initial')
  }

  function onRefresh() {
    setRefreshing(true)
    void load('refresh')
  }

  async function connect(inquiryId: number) {
    if (inFlight.current) return
    inFlight.current = true
    setConnectingId(inquiryId)
    setError('')
    try {
      const { conversationId } = await connectBroInquiry(inquiryId)
      router.push(`/dashboard/messages/${conversationId}` as never)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : b.errGeneric)
    } finally {
      inFlight.current = false
      setConnectingId(null)
    }
  }

  let body: React.ReactNode
  if (!loggedIn) {
    body = (
      <EmptyState
        title={b.foundTitle}
        subtitle={b.foundSubtitle}
        actionLabel={t.login}
        onAction={() => router.push({ pathname: '/(auth)/login', params: { redirect: '/bro-finds' } } as never)}
      />
    )
  } else if (loading) {
    body = (
      <View style={{ gap: spacing.md }}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    )
  } else if (failed || !groups) {
    body = <ErrorState title={b.errGeneric} retryLabel={b.retry} onRetry={retry} />
  } else if (groups.length === 0) {
    body = <EmptyState title={b.foundEmpty} actionLabel={b.newRequest} onAction={() => router.push('/bro/new' as never)} />
  } else {
    body = (
      <View style={{ gap: spacing.lg }}>
        {groups.map(g => (
          <View key={g.request.id} style={{ gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/bro/requests/${g.request.id}` as never)}
              style={({ pressed }) => [styles.groupHead, rowDir, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.groupTitle, dirStyle]} numberOfLines={1}>
                {b.foundForRequest.replace(
                  '{model}',
                  `${g.request.modelText}${g.request.storage ? ` · ${g.request.storage}` : ''}`,
                )}
              </Text>
              <Text style={styles.groupLink}>{ar ? '‹' : '›'}</Text>
            </Pressable>
            {g.matches.map(m => (
              <BroMatchCard key={m.inquiryId} match={m} busy={connectingId === m.inquiryId} now={now} onConnect={connect} />
            ))}
          </View>
        ))}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          loggedIn ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.y]} tintColor={colors.y} />
          ) : undefined
        }
      >
        <View style={[styles.header, rowDir]}>
          <BroAvatar size={40} radius={20} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, dirStyle]}>{b.foundTitle}</Text>
            <Text style={[styles.sub, dirStyle]}>{b.foundSubtitle}</Text>
          </View>
        </View>

        {loggedIn ? (
          <View style={[styles.actions, rowDir]}>
            <Button label={b.newRequest} variant="dk" size="sm" onPress={() => router.push('/bro/new' as never)} />
            <Button label={b.allRequests} variant="outline" size="sm" onPress={() => router.push('/bro' as never)} />
          </View>
        ) : null}

        {error ? <Text style={[styles.err, dirStyle]}>{error}</Text> : null}

        {body}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: fonts.extraBold, fontSize: 20, color: '#1A2540' },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.g500 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 15, color: '#1A2540' },
  groupLink: { fontFamily: fonts.bold, fontSize: 20, color: colors.g500 },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
})
