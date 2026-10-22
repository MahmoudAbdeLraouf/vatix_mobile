import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { useLoginGate } from '@/contexts/loginGate'
import { getBrands, getCategories, getLocations, localeName, type Brand, type Category, type LocationNode } from '@/lib/api'
import { getBroBoard, getBroUsage, type BroBoardItem, type BroUsage, type CreateBroOfferResult } from '@/lib/bro'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { BroBoardCard } from '@/components/bro/BroBoardCard'
import { BroOfferSheet } from '@/components/bro/BroOfferSheet'
import { BroUsageMeter } from '@/components/bro/BroUsageMeter'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Button } from '@/components/ui/Button'
import { colors, fonts, radius, spacing } from '@/constants/theme'

type Sort = 'newest' | 'budget'

/** Public board of buyer requests that sellers can answer with an offer. Mirrors the website /requests. */
export default function RequestsTab() {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const { user, loading: authLoading } = useAuth()
  const { requireLogin } = useLoginGate()
  const broEnabled = useBroEnabled()
  const userType = user?.type === 'client' || user?.type === 'store' ? user.type : null

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [sort, setSort] = useState<Sort>('newest')

  const [items, setItems] = useState<BroBoardItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [boardGone, setBoardGone] = useState(false)
  const [usage, setUsage] = useState<BroUsage | null>(null)
  const [sheet, setSheet] = useState<{ id: number; modelText?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const reqSeq = useRef(0)

  useEffect(() => {
    getCategories().then(c => setCategories(c.filter(x => x.isActive))).catch(() => {})
    getBrands().then(br => setBrands(br.filter(x => x.isActive))).catch(() => {})
    getLocations().then(l => setLocations(l.filter(x => x.isActive))).catch(() => {})
  }, [])

  const brandOptions = useMemo(
    () => [{ value: '', label: b.boardAllBrands }, ...brands.map(br => ({ value: String(br.id), label: localeName(br.translations, locale) }))],
    [brands, locale, b.boardAllBrands],
  )
  const categoryOptions = useMemo(
    () => [{ value: '', label: b.boardAllCategories }, ...categories.map(c => ({ value: String(c.id), label: localeName(c.translations, locale) }))],
    [categories, locale, b.boardAllCategories],
  )
  const locationOptions = useMemo(
    () => [{ value: '', label: b.boardAllAreas }, ...locations.map(l => ({ value: String(l.id), label: localeName(l.translations, locale) }))],
    [locations, locale, b.boardAllAreas],
  )

  const loadPage = useCallback((nextPage: number, append: boolean) => {
    const seq = ++reqSeq.current
    return getBroBoard({
      categoryId: categoryId ? Number(categoryId) : undefined,
      brandId: brandId ? Number(brandId) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
      page: nextPage,
      sort,
    }).then(res => {
      if (seq !== reqSeq.current) return
      setItems(prev => (append ? [...prev, ...res.items] : res.items))
      setTotal(res.total)
      setPage(res.page)
      setFailed(false)
    }, (err: unknown) => {
      if (seq !== reqSeq.current) return
      // A 404 on the board means the feature is off; anything else is a retryable failure.
      if ((err as { status?: number }).status === 404) setBoardGone(true)
      else setFailed(true)
    }).finally(() => {
      if (seq === reqSeq.current) {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    })
  }, [categoryId, brandId, locationId, sort])

  // Drop the previous result set before a (re)load of page 1, so a failure there shows the
  // error + retry branch instead of stale cards from the old filter.
  function resetBoard() {
    setItems([])
    setTotal(0)
    setPage(1)
    setFailed(false)
    setLoadingMore(false)
    setLoading(true)
  }

  // Wait for auth to resolve so the first fetch carries the viewer's token (isMine / myOffer).
  useEffect(() => {
    if (!broEnabled || authLoading) return
    void loadPage(1, false)
  }, [broEnabled, authLoading, loadPage])

  const loadUsage = useCallback(() => {
    if (userType !== 'client') return
    getBroUsage().then(u => { if (u) setUsage(u) })
  }, [userType])

  useEffect(() => {
    if (!broEnabled || authLoading) return
    loadUsage()
  }, [broEnabled, authLoading, loadUsage])

  const hasFilters = !!(categoryId || brandId || locationId)
  const hasMore = items.length < total

  function clearFilters() {
    resetBoard()
    setCategoryId('')
    setBrandId('')
    setLocationId('')
  }

  function onRefresh() {
    setRefreshing(true)
    loadUsage()
    void loadPage(1, false)
  }

  function loadMore() {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    setFailed(false)
    void loadPage(page + 1, true)
  }

  function countLabel(n: number): string {
    let rule = n === 1 ? 'one' : n === 2 ? 'two' : 'many'
    try {
      rule = new Intl.PluralRules(ar ? 'ar' : 'en').select(n)
    } catch {
      // Intl.PluralRules missing on this engine: keep the simple fallback above.
    }
    const tpl = rule === 'one' ? b.boardCountOne : rule === 'two' ? b.boardCountTwo : rule === 'few' ? b.boardCountFew : b.boardCountMany
    return tpl.replace('{n}', String(n))
  }

  function makeOffer(item: BroBoardItem) {
    setNotice(null)
    if (!requireLogin()) return
    if (!userType) return // admin sessions cannot post offers
    setSheet({ id: item.id, modelText: item.modelText })
  }

  function onSent(offer: CreateBroOfferResult) {
    setItems(prev => prev.map(i => i.id === offer.requestId
      ? { ...i, offerCount: i.offerCount + 1, myOffer: { id: offer.id, status: offer.status } }
      : i))
    setNotice(offer.productCreated ? b.offerSentProductCreated
      : offer.productSkippedReason === 'error' ? b.offerSentProductFailed
      : b.offerSentToast)
    loadUsage()
    setSheet(null)
  }

  if (!broEnabled || boardGone) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={[styles.cardTitle, dirStyle]}>{b.unavailableTitle}</Text>
            <Text style={[styles.cardBody, dirStyle]}>{b.unavailableBody}</Text>
            <Button label={b.unavailableHome} variant="dk" size="md" onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const header = (
    <View style={styles.headerWrap}>
      <View>
        <Text style={[styles.h1, dirStyle]}>{b.boardTitle}</Text>
        <Text style={[styles.sub, dirStyle]}>{b.boardSubtitle}</Text>
      </View>

      <View style={styles.pillRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/bro/new', params: { source: 'nav' } } as never)}
          style={({ pressed }) => [styles.geekoPill, pressed && styles.pressed]}
        >
          <BroAvatar size={26} />
          <Text style={styles.geekoText}>{b.boardAskGeeko}</Text>
          <Text style={styles.geekoStar}>✦</Text>
        </Pressable>
        {userType ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/bro/offers' as never)}
            style={({ pressed }) => [styles.myOffersPill, pressed && styles.pressed]}
          >
            <Text style={styles.myOffersText}>{b.myOffersTitle}</Text>
          </Pressable>
        ) : null}
        {/* Geeko finds lost its tab to this board, so it's reachable from here. */}
        {userType ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/(tabs)/bro-finds' as never)}
            style={({ pressed }) => [styles.myOffersPill, pressed && styles.pressed]}
          >
            <Text style={styles.myOffersText}>{b.foundNavLink}</Text>
          </Pressable>
        ) : null}
      </View>

      {userType === 'client' && usage ? <BroUsageMeter usage={usage} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[{ value: '', label: b.allCategories }, ...categoryOptions.slice(1)].map(c => {
          const on = categoryId === c.value
          return (
            <Pressable
              key={c.value || 'all'}
              onPress={() => { if (on) return; resetBoard(); setCategoryId(c.value) }}
              style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        {(['newest', 'budget'] as const).map(s => {
          const on = sort === s
          return (
            <Pressable
              key={s}
              onPress={() => { if (on) return; resetBoard(); setSort(s) }}
              style={[styles.sortBtn, on && styles.sortBtnOn]}
            >
              <Text style={[styles.sortText, on && styles.sortTextOn]}>{s === 'newest' ? b.sortNewest : b.sortBudget}</Text>
            </Pressable>
          )
        })}
      </View>

      <SearchableSelect
        options={brandOptions}
        value={brandId}
        onChange={v => { resetBoard(); setBrandId(v) }}
        placeholder={b.boardFilterBrandPlaceholder}
      />
      <SearchableSelect
        options={locationOptions}
        value={locationId}
        onChange={v => { resetBoard(); setLocationId(v) }}
        placeholder={b.boardFilterAreaPlaceholder}
      />

      {(!loading && !failed) || hasFilters ? (
        <View style={styles.countRow}>
          <Text style={[styles.count, dirStyle]}>{loading ? '' : countLabel(total)}</Text>
          {hasFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clear}>{b.boardClearFilters}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <View style={styles.notice}>
          <Text style={[styles.noticeText, dirStyle]}>{notice}</Text>
        </View>
      ) : null}
    </View>
  )

  const empty = loading ? (
    <View style={styles.center}><ActivityIndicator color={colors.y} /></View>
  ) : failed ? (
    <View style={styles.center}>
      <Text style={[styles.cardBody, dirStyle]}>{b.boardLoadFailed}</Text>
      <Button label={b.retry} variant="dk" size="md" onPress={() => { resetBoard(); void loadPage(1, false) }} />
    </View>
  ) : (
    <View style={styles.center}><Text style={[styles.cardBody, dirStyle]}>{b.boardEmpty}</Text></View>
  )

  const footer = items.length === 0 ? null : (
    <View style={styles.footer}>
      {failed ? <Text style={[styles.err, dirStyle]}>{b.boardLoadFailed}</Text> : null}
      {hasMore ? (
        <Button
          label={loadingMore ? b.boardLoadingMore : failed ? b.retry : b.boardLoadMore}
          variant="outline"
          size="md"
          disabled={loadingMore}
          onPress={loadMore}
        />
      ) : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => <BroBoardCard item={item} onMakeOffer={() => makeOffer(item)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (!failed) loadMore() }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.y} />}
      />
      {sheet && userType ? (
        <BroOfferSheet
          visible
          requestId={sheet.id}
          userType={userType}
          modelText={sheet.modelText}
          onClose={() => setSheet(null)}
          onSent={onSent}
        />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  headerWrap: { gap: 12 },
  h1: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.dk },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.g500, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  geekoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dk,
    borderWidth: 1.5,
    borderColor: colors.y,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingStart: 6,
    paddingEnd: 14,
  },
  geekoText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  geekoStar: { fontFamily: fonts.bold, fontSize: 13, color: colors.y },
  myOffersPill: {
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  myOffersText: { fontFamily: fonts.bold, fontSize: 13, color: colors.dk },
  pressed: { opacity: 0.85 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1.5 },
  chipOn: { backgroundColor: colors.dk, borderColor: colors.dk },
  chipOff: { backgroundColor: colors.white, borderColor: colors.g300 },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.g700 },
  chipTextOn: { color: colors.white },
  sortRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.g300,
    borderRadius: radius.full,
    padding: 3,
  },
  sortBtn: { borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 14 },
  sortBtnOn: { backgroundColor: colors.yl },
  sortText: { fontFamily: fonts.bold, fontSize: 13, color: colors.g500 },
  sortTextOn: { color: colors.dk },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, color: colors.g600 },
  clear: { fontFamily: fonts.bold, fontSize: 13, color: '#D9A200', textDecorationLine: 'underline' },
  notice: { backgroundColor: colors.yl, borderRadius: radius.md, padding: 12 },
  noticeText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.dk },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  footer: { gap: spacing.sm, alignItems: 'stretch' },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.dk },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.g600 },
})
