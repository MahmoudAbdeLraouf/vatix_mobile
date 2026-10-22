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
  type MyOfferItem,
  type MyOfferState,
  type OfferContent,
} from '@/lib/bro'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { BroButton } from '@/components/bro/BroButton'
import { BroOfferForm } from '@/components/bro/BroOfferForm'
import { useBroDir } from '@/components/bro/BroCardParts'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Tab = 'mine' | 'saved'

const STATE_COLORS: Record<MyOfferState, { bg: string; fg: string }> = {
  active: { bg: '#e6f7ec', fg: '#1a7f3c' },
  closed: { bg: colors.g200, fg: colors.g700 },
  unavailable: { bg: '#fff8e1', fg: '#8a6500' },
  withdrawn: { bg: colors.g200, fg: colors.g600 },
}

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

/** Seller's offers on buyer requests + their reusable saved offers (mirrors the website's /bro/offers). */
export default function BroOffersScreen() {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const broEnabled = useBroEnabled()
  const [tab, setTab] = useState<Tab>('mine')

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: b.myOffersTitle }} />
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
          <View style={[styles.tabs, rowDir]}>
            <BroButton
              label={b.myOffersTitle}
              chip
              selected={tab === 'mine'}
              onPress={() => setTab('mine')}
            />
            <BroButton label={b.savedTab} chip selected={tab === 'saved'} onPress={() => setTab('saved')} />
          </View>
          {tab === 'mine' ? <MyOffersTab /> : <SavedOffersTab />}
        </>
      )}
    </SafeAreaView>
  )
}

function MyOffersTab() {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const price = usePrice()
  const seq = useRef(0)
  const [items, setItems] = useState<MyOfferItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rowError, setRowError] = useState<{ id: number; msg: string } | null>(null)

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
      setPage(1)
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

  return (
    <ScrollView
      contentContainerStyle={[styles.pad, items.length === 0 && styles.grow]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(true)} colors={[colors.y]} tintColor={colors.y} />
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="pricetags-outline" size={40} color={colors.g400} />}
          title={b.myOffersEmpty}
          actionLabel={b.browseRequests}
          onAction={() => router.push('/(tabs)/requests' as never)}
        />
      ) : (
        items.map(o => {
          const c = STATE_COLORS[o.state] ?? STATE_COLORS.closed
          const model = [o.request.modelText, o.request.storage].filter(Boolean).join(' · ')
          return (
            <View key={o.id} style={styles.card}>
              <View style={[styles.headRow, rowDir]}>
                <View style={styles.flex}>
                  <Text style={[styles.model, dirStyle]} numberOfLines={2}>{model}</Text>
                  <Text style={[styles.muted, dirStyle]}>{o.request.locationName ?? b.offerNoArea}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.badgeText, { color: c.fg }]}>{stateLabel[o.state]}</Text>
                </View>
              </View>
              <View style={[styles.headRow, rowDir]}>
                <Text style={[styles.offerTitle, styles.flex, dirStyle]} numberOfLines={2}>{o.title}</Text>
                <Text style={styles.price}>{price(o.price)}</Text>
              </View>
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
              ) : null}
            </View>
          )
        })
      )}
      {items.length > 0 && items.length < total ? (
        <BroButton
          label={loadingMore ? b.boardLoadingMore : b.boardLoadMore}
          disabled={loadingMore}
          size="md"
          fullWidth
          onPress={loadMore}
        />
      ) : null}
    </ScrollView>
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
          <EmptyState icon={<Ionicons name="bookmark-outline" size={40} color={colors.g400} />} title={b.noSavedOffers} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  pad: { padding: spacing.md, gap: spacing.md },
  grow: { flexGrow: 1, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 10,
    ...shadow.ss,
  },
  dim: { opacity: 0.75 },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.dk },
  cardBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.g600 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  model: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.dk },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  offerTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.g800 },
  price: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.dk },
  hint: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.red, marginTop: 2 },
  error: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.g100 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetHeader: {
    backgroundColor: colors.dk,
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
