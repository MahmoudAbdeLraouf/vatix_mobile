import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { broHeader } from '@/components/bro/BroStackHeader'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import { imgUrl } from '@/lib/api'
import {
  deleteSavedBroOffer,
  listMyBroOffers,
  listSavedBroOffers,
  updateSavedBroOffer,
  withdrawBroOffer,
  type BroApiError,
  type BroSavedOffer,
  type MyOfferCounts,
  type MyOfferItem,
  type MyOfferState,
  type OfferContent,
} from '@/lib/bro'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { BroButton } from '@/components/bro/BroButton'
import { BroOfferForm } from '@/components/bro/BroOfferForm'
import { useBroCardFormat, useBroDir } from '@/components/bro/BroCardParts'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

type Tab = 'mine' | 'saved'

const makeStateColors = (colors: ThemeColors, dark: boolean): Record<MyOfferState, { bg: string; fg: string }> => ({
  active: dark ? { bg: colors.greenBg, fg: colors.green } : { bg: '#e6f7ec', fg: '#1a7f3c' },
  closed: { bg: colors.border, fg: colors.text },
  unavailable: { bg: colors.yellowBg, fg: colors.yellowText },
  withdrawn: { bg: colors.border, fg: colors.muted },
})
const themedStateColors = { light: makeStateColors(lightColors, false), dark: makeStateColors(darkColors, true) }

function errMessage(err: unknown, fallback: string): string {
  const e = err as BroApiError
  const bodyMsg = (e?.body as { message?: unknown } | undefined)?.message
  return (typeof bodyMsg === 'string' ? bodyMsg : e?.message) || fallback
}

function usePrice() {
  const { t, locale } = useLocale()
  return (v: number | string) =>
    t.bro.priceEgp.replace('{price}', Number(v).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US'))
}

type SentFilter = 'all' | 'active' | 'connected' | 'closed'

function sentFilterMatch(o: MyOfferItem, f: SentFilter): boolean {
  if (f === 'all') return true
  if (f === 'connected') return !!o.buyerConnectedAt
  if (f === 'active') return o.state === 'active'
  return o.state !== 'active'
}

/** Seller's offers on buyer requests + their reusable saved offers (mirrors the website's /bro/offers). */
export default function BroOffersScreen() {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const broEnabled = useBroEnabled()
  const [tab, setTab] = useState<Tab>('mine')
  const styles = useStyles()

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={broHeader(b.myOffersTitle)} />
      {!broEnabled ? (
        <View style={styles.pad}>
          <View style={styles.card}>
            <Text style={[styles.cardTitle, dirStyle]}>{b.unavailableTitle}</Text>
            <Text style={[styles.cardBody, dirStyle]}>{b.unavailableBody}</Text>
            <Button label={b.unavailableHome} variant="dk" size="md" onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.pageHead, rowDir]}>
            <View style={styles.flex}>
              <Text style={[styles.pageTitle, dirStyle]}>{b.myOffersTitle}</Text>
              <Text style={[styles.pageSub, dirStyle]}>{b.offersSubtitle}</Text>
            </View>
            <BroButton label={b.newRequestsBtn} variant="yellow" onPress={() => router.push('/(tabs)/requests' as never)} />
          </View>
          <View style={[styles.segment, rowDir]}>
            {(['mine', 'saved'] as const).map(k => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={[styles.segItem, tab === k && styles.segItemOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
              >
                <Text style={[styles.segText, tab === k && styles.segTextOn]}>{k === 'mine' ? b.sentTab : b.savedTab}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'mine' ? <MyOffersTab /> : <SavedOffersTab />}
        </>
      )}
    </SafeAreaView>
  )
}

function MyOffersTab() {
  const { t, locale } = useLocale()
  const b = t.bro
  const { ar, dirStyle, rowDir } = useBroDir()
  const price = usePrice()
  const seq = useRef(0)
  const [items, setItems] = useState<MyOfferItem[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<MyOfferCounts | null>(null)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [filter, setFilter] = useState<SentFilter>('all')
  const [now, setNow] = useState(() => Date.now())
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rowError, setRowError] = useState<{ id: number; msg: string } | null>(null)
  const { colors, mode } = useTheme()
  const styles = useStyles()
  const STATE_COLORS = themedStateColors[mode]
  const { ago } = useBroCardFormat(now)
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')

  const loadFirst = useCallback(async (pull: boolean) => {
    const ticket = ++seq.current
    if (pull) setRefreshing(true)
    else setLoading(true)
    setFailed(false)
    if (!(await isLoggedIn())) {
      router.replace({ pathname: '/(auth)/login', params: { redirect: '/bro/offers' } } as never)
      return
    }
    const res = await listMyBroOffers(1)
    if (ticket !== seq.current) return
    if (!res) setFailed(true)
    else {
      setItems(res.items)
      setTotal(res.total)
      setCounts(res.counts ?? null)
      setNearbyCount(res.nearbyOpenCount ?? 0)
      setPage(1)
      setNow(Date.now())
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadFirst(false)
    return () => {
      seq.current++
    }
  }, [loadFirst, reloadKey])

  async function loadMore() {
    if (loadingMore) return
    const ticket = seq.current
    setLoadingMore(true)
    const next = page + 1
    const res = await listMyBroOffers(next)
    if (ticket !== seq.current) return
    setLoadingMore(false)
    if (!res) return
    setItems(prev => {
      const seen = new Set(prev.map(o => o.id))
      return [...prev, ...res.items.filter(o => !seen.has(o.id))]
    })
    setTotal(res.total)
    setPage(next)
  }

  function confirmWithdraw(o: MyOfferItem) {
    Alert.alert(b.withdrawConfirm, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: b.withdraw, style: 'destructive', onPress: () => withdraw(o) },
    ])
  }

  async function withdraw(o: MyOfferItem) {
    setBusyId(o.id)
    setRowError(null)
    try {
      await withdrawBroOffer(o.id)
      setItems(prev => prev.map(x => (x.id === o.id ? { ...x, state: 'withdrawn', status: 'withdrawn' } : x)))
      setCounts(c => c && { ...c, active: c.active - 1, closed: c.closed + 1 })
    } catch (err) {
      setRowError({ id: o.id, msg: errMessage(err, b.withdrawFailed) })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <View style={styles.pad}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    )
  }
  if (failed) {
    return <ErrorState title={b.myOffersLoadFailed} retryLabel={b.retry} onRetry={() => setReloadKey(k => k + 1)} />
  }

  const stateLabel: Record<MyOfferState, string> = {
    active: b.stateActive,
    closed: b.stateClosed,
    unavailable: b.stateUnavailable,
    withdrawn: b.stateWithdrawn,
  }
  const tally: MyOfferCounts = {
    all: items.length,
    active: items.filter(o => o.state === 'active').length,
    connected: items.filter(o => !!o.buyerConnectedAt).length,
    closed: items.filter(o => o.state !== 'active').length,
  }
  const chips: { key: SentFilter; label: string }[] = [
    { key: 'all', label: b.filterAll },
    { key: 'active', label: b.chipActive },
    { key: 'connected', label: b.chipConnected },
    { key: 'closed', label: b.chipClosed },
  ]
  const shown = items.filter(o => sentFilterMatch(o, filter))

  return (
    <ScrollView
      contentContainerStyle={[styles.pad, items.length === 0 && styles.grow]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(true)} colors={[colors.y]} tintColor={colors.y} />
      }
    >
      {items.length === 0 ? (
        <>
          <EmptyState
            icon={<Ionicons name="pricetags-outline" size={40} color={colors.subtle} />}
            title={b.myOffersEmpty}
            actionLabel={b.browseRequests}
            onAction={() => router.push('/(tabs)/requests' as never)}
          />
          <BrowseCta nearbyCount={nearbyCount} />
        </>
      ) : (
        <>
          <View style={[styles.stats, rowDir]}>
            {([
              ['all', b.statSent],
              ['active', b.statActive],
              ['connected', b.statConnected],
            ] as const).map(([key, label], i) => {
              const n = counts?.[key] ?? tally[key]
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  style={[styles.stat, i > 0 && styles.statDivider, filter === key && styles.statOn]}
                >
                  <Text style={[styles.statNum, key === 'connected' && n > 0 && styles.statNumGreen]}>{fmt(n)}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, rowDir]}>
            {chips.map(c => {
              const on = filter === c.key
              return (
                <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {c.label} {fmt(counts?.[c.key] ?? tally[c.key])}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
          {shown.length === 0 ? <Text style={[styles.none, dirStyle]}>{b.noneInFilter}</Text> : null}
          {shown.map(o => {
            const c = STATE_COLORS[o.state] ?? STATE_COLORS.closed
            const model = [o.request.modelText, o.request.storage].filter(Boolean).join(' ')
            const ended = o.state !== 'active'
            const thumb = o.images?.[0]
            return (
              <View key={o.id} style={[styles.card, ended && styles.dim]}>
                <View style={[styles.headRow, rowDir, styles.top]}>
                  {thumb ? (
                    <Image source={{ uri: imgUrl(thumb) ?? undefined }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Ionicons name="phone-portrait-outline" size={22} color={colors.subtle} />
                    </View>
                  )}
                  <View style={[styles.flex, styles.gap4]}>
                    <View style={[styles.reqTag, ar ? styles.selfEnd : styles.selfStart]}>
                      <Text style={styles.reqTagText} numberOfLines={1}>
                        {b.onRequest.replace('{request}', model)}
                      </Text>
                    </View>
                    <Text style={[styles.offerTitle, dirStyle]} numberOfLines={2}>{o.title}</Text>
                    <Text style={[styles.muted, dirStyle]} numberOfLines={1}>
                      <Text style={styles.price}>{price(o.price)}</Text>
                      {' · '}
                      {o.request.locationName ?? b.offerNoArea}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: c.bg }]}>
                    <Text style={[styles.badgeText, { color: c.fg }]}>{stateLabel[o.state]}</Text>
                  </View>
                </View>
                {o.buyerConnectedAt ? (
                  <View style={[styles.connected, rowDir]}>
                    <Text style={[styles.connectedText, styles.flex, dirStyle]}>
                      {b.buyerConnected.replace('{ago}', ago(o.buyerConnectedAt))}
                    </Text>
                    <Pressable
                      style={styles.replyBtn}
                      onPress={() =>
                        router.push(
                          (o.conversationId ? `/dashboard/messages/${o.conversationId}` : '/dashboard/messages') as never,
                        )
                      }
                    >
                      <Text style={styles.replyText}>{b.replyToBuyer}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {rowError?.id === o.id ? <Text style={[styles.error, dirStyle]}>{rowError.msg}</Text> : null}
                {o.state === 'active' ? (
                  <View style={[styles.actions, rowDir]}>
                    <BroButton
                      label={busyId === o.id ? b.withdrawing : b.withdraw}
                      icon="close-circle-outline"
                      disabled={busyId === o.id}
                      onPress={() => confirmWithdraw(o)}
                    />
                  </View>
                ) : (
                  <Pressable onPress={() => router.push('/(tabs)/requests' as never)}>
                    <Text style={[styles.elsewhere, dirStyle]}>{b.offerElsewhere}</Text>
                  </Pressable>
                )}
              </View>
            )
          })}
          {items.length < total ? (
            <BroButton
              label={loadingMore ? b.boardLoadingMore : b.boardLoadMore}
              disabled={loadingMore}
              size="md"
              fullWidth
              onPress={loadMore}
            />
          ) : (
            <BrowseCta nearbyCount={nearbyCount} />
          )}
        </>
      )}
    </ScrollView>
  )
}

function BrowseCta({ nearbyCount }: { nearbyCount: number }) {
  const { t, locale } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const styles = useStyles()
  const n = nearbyCount.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')
  return (
    <View style={[styles.cta, rowDir]}>
      <Text style={styles.ctaEmoji}>🔎</Text>
      <View style={styles.flex}>
        <Text style={[styles.ctaTitle, dirStyle]}>{b.browseCtaTitle}</Text>
        {nearbyCount > 0 ? (
          <Text style={[styles.ctaNearby, dirStyle]}>{b.browseCtaNearby.replace('{n}', n)}</Text>
        ) : (
          <Text style={[styles.ctaBody, dirStyle]}>{b.browseCtaBody}</Text>
        )}
      </View>
      <BroButton label={b.browseRequests} variant="yellow" onPress={() => router.push('/(tabs)/requests' as never)} />
    </View>
  )
}

function toContent(s: BroSavedOffer): OfferContent {
  return {
    title: s.title,
    price: Number(s.price),
    locationId: s.locationId,
    scratches: s.scratches,
    hasBox: s.hasBox,
    hasInvoice: s.hasInvoice,
    hasWarranty: s.hasWarranty,
    warrantyNote: s.warrantyNote,
    sellerNote: s.sellerNote,
    images: s.images,
    productId: s.productId,
  }
}

function SavedOffersTab() {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const price = usePrice()
  const seq = useRef(0)
  const [items, setItems] = useState<BroSavedOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rowError, setRowError] = useState<{ id: number; msg: string } | null>(null)
  const [editing, setEditing] = useState<BroSavedOffer | null>(null)
  const { colors } = useTheme()
  const styles = useStyles()

  const load = useCallback(async (pull: boolean) => {
    const ticket = ++seq.current
    if (pull) setRefreshing(true)
    else setLoading(true)
    setFailed(false)
    if (!(await isLoggedIn())) {
      router.replace({ pathname: '/(auth)/login', params: { redirect: '/bro/offers' } } as never)
      return
    }
    const res = await listSavedBroOffers()
    if (ticket !== seq.current) return
    if (!res) setFailed(true)
    else setItems(res)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load(false)
    return () => {
      seq.current++
    }
  }, [load, reloadKey])

  function confirmDelete(s: BroSavedOffer) {
    Alert.alert(b.deleteSavedConfirm, undefined, [
      { text: t.cancel, style: 'cancel' },
      { text: b.deleteSaved, style: 'destructive', onPress: () => remove(s) },
    ])
  }

  async function remove(s: BroSavedOffer) {
    setBusyId(s.id)
    setRowError(null)
    try {
      await deleteSavedBroOffer(s.id)
      setItems(prev => prev.filter(x => x.id !== s.id))
    } catch {
      setRowError({ id: s.id, msg: b.deleteSavedFailed })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <View style={styles.pad}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    )
  }
  if (failed) {
    return <ErrorState title={b.savedLoadFailed} retryLabel={b.retry} onRetry={() => setReloadKey(k => k + 1)} />
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.pad, items.length === 0 && styles.grow]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.y]} tintColor={colors.y} />
        }
      >
        {items.length === 0 ? (
          <EmptyState icon={<Ionicons name="bookmark-outline" size={40} color={colors.subtle} />} title={b.noSavedOffers} />
        ) : (
          items.map(s => {
            const thumb = imgUrl(s.images[0], { w: 160 })
            return (
              <View key={s.id} style={[styles.card, !s.available && styles.dim]}>
                <View style={[styles.headRow, rowDir]}>
                  {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={styles.flex}>
                    <Text style={[styles.offerTitle, dirStyle]} numberOfLines={2}>{s.title}</Text>
                    <Text style={[styles.price, dirStyle]}>{price(s.price)}</Text>
                    {!s.available ? <Text style={[styles.hint, dirStyle]}>{b.savedUnavailableHint}</Text> : null}
                  </View>
                </View>
                {rowError?.id === s.id ? <Text style={[styles.error, dirStyle]}>{rowError.msg}</Text> : null}
                <View style={[styles.actions, rowDir]}>
                  <BroButton label={b.editSaved} icon="create-outline" onPress={() => setEditing(s)} />
                  <BroButton
                    label={b.deleteSaved}
                    icon="trash-outline"
                    disabled={busyId === s.id}
                    onPress={() => confirmDelete(s)}
                  />
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
      <EditSavedSheet
        saved={editing}
        onClose={() => setEditing(null)}
        onSaved={updated => {
          setItems(prev =>
            prev.map(x => (x.id === updated.id ? { ...updated, available: updated.available ?? x.available } : x)),
          )
          setEditing(null)
        }}
      />
    </>
  )
}

function EditSavedSheet({
  saved,
  onClose,
  onSaved,
}: {
  saved: BroSavedOffer | null
  onClose: () => void
  onSaved: (s: BroSavedOffer) => void
}) {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const closeBlocked = uploading || saving

  useEffect(() => {
    setError(null)
    setUploading(false)
    setSaving(false)
  }, [saved?.id])

  function dismiss() {
    if (!closeBlocked) onClose()
  }

  async function submit(content: OfferContent) {
    if (!saved) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateSavedBroOffer(saved.id, content)
      onSaved({ ...updated, available: updated.available ?? saved.available })
    } catch (err) {
      setError(errMessage(err, b.saveEditFailed))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={!!saved} transparent animationType="slide" onRequestClose={dismiss}>
      {saved ? (
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]} accessibilityViewIsModal>
            <View style={[styles.sheetHeader, rowDir]}>
              <View style={styles.flex}>
                <Text style={[styles.sheetTitle, dirStyle]}>{b.editSavedTitle}</Text>
                <Text style={[styles.sheetSub, dirStyle]}>{b.savedEditNote}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={b.sheetClose}
                onPress={dismiss}
                disabled={closeBlocked}
                hitSlop={10}
                style={{ opacity: closeBlocked ? 0.4 : 1 }}
              >
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <BroOfferForm
                key={saved.id}
                initial={toContent(saved)}
                productImages={[]}
                showSave={false}
                onSubmit={submit}
                error={error}
                onUploadingChange={setUploading}
                submitLabel={{ idle: b.saveEditBtn, busy: b.savingEdit }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing.md, gap: spacing.md },
  grow: { flexGrow: 1, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  pageTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.heading },
  pageSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: 4,
    borderRadius: 12,
    backgroundColor: dark ? colors.card : '#f7f8fa',
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : null),
  },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segItemOn: { backgroundColor: dark ? colors.border : '#fff', ...(dark ? null : shadow.ss) },
  segText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted },
  segTextOn: { fontFamily: fonts.extraBold, color: colors.heading },
  stats: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.ss),
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statDivider: { borderStartWidth: 1, borderStartColor: colors.border },
  statOn: { backgroundColor: dark ? colors.border : '#f7f8fa' },
  statNum: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 28, color: colors.heading },
  statNumGreen: { color: colors.green },
  statLabel: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 18, color: colors.muted },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.dk, borderColor: colors.dk },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  chipTextOn: { color: '#fff' },
  none: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.md },
  top: { alignItems: 'flex-start' },
  gap4: { gap: 4 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  selfEnd: { alignSelf: 'flex-end' },
  reqTag: { backgroundColor: colors.yellowBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, maxWidth: '100%' },
  reqTagText: { fontFamily: fonts.bold, fontSize: 11, color: dark ? colors.yellowText : '#8a6500' },
  connected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: dark ? colors.greenBg : '#e6f7ec',
    borderRadius: 10,
    padding: 10,
  },
  connectedText: { fontFamily: fonts.bold, fontSize: 12.5, color: dark ? colors.green : '#1a7f3c' },
  replyBtn: { backgroundColor: dark ? colors.green : '#1a7f3c', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  replyText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  elsewhere: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, textDecorationLine: 'underline' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dk, borderRadius: 16, padding: 16 },
  ctaEmoji: { fontSize: 28 },
  ctaTitle: { fontFamily: fonts.extraBold, fontSize: 14, color: '#fff' },
  ctaNearby: { fontFamily: fonts.bold, fontSize: 12, color: colors.y, marginTop: 2 },
  ctaBody: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 10,
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.ss),
  },
  dim: { opacity: 0.75 },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.heading },
  cardBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  model: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  offerTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  price: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.price },
  hint: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.red, marginTop: 2 },
  error: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.placeholder },
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetHeader: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.white },
  sheetSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  sheetContent: { padding: spacing.lg, gap: spacing.md },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
