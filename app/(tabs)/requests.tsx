import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
import { CategoryBar } from '@/components/CategoryBar'
import { MessagesBell } from '@/components/MessagesBell'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Button } from '@/components/ui/Button'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Sort = 'newest' | 'budget'

/** Public board of buyer requests that sellers can answer with an offer. Mirrors the website /requests. */
export default function RequestsTab() {
  const { locale, t, isRtl, setLocale } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const filtersLabel = ar ? 'الفلاتر' : 'Filters'
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

  const activeFilterCount = [categoryId, brandId, locationId].filter(Boolean).length

  // Same navy title bar as Products / Stores: title + locale, messages, notifications.
  const topBar = (
    <View style={styles.titleRow}>
      <Text style={styles.title} numberOfLines={1}>{b.boardTitle}</Text>
      <View style={styles.titleActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setLocale(ar ? 'en' : 'ar')}>
          <Ionicons name="globe-outline" size={20} color={colors.white} />
        </TouchableOpacity>
        <MessagesBell color={colors.white} size={20} style={styles.iconBtn} />
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/dashboard/notifications')}>
          <Ionicons name="notifications-outline" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )

  if (!broEnabled || boardGone) {
    return (
      <SafeAreaView style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
        <View style={styles.header}>{topBar}</View>
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.list}>
            <View style={styles.card}>
              <Text style={[styles.cardTitle, dirStyle]}>{b.unavailableTitle}</Text>
              <Text style={[styles.cardBody, dirStyle]}>{b.unavailableBody}</Text>
              <Button label={b.unavailableHome} variant="dk" size="md" onPress={() => router.replace('/(tabs)/home')} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    )
  }

  const listHeader = (
    <View style={styles.listHeader}>
      {userType === 'client' && usage ? <BroUsageMeter usage={usage} /> : null}

      <View style={styles.filterCard}>
        <View style={styles.filterCardHeader}>
          <View style={styles.filterTitleRow}>
            <Ionicons name="options-outline" size={16} color={colors.dk} />
            <Text style={styles.filterTitle}>{filtersLabel}</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountPill}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </View>
          {hasFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8} style={styles.resetBtn}>
              <Ionicons name="refresh-outline" size={13} color={colors.g600} />
              <Text style={styles.resetBtnText}>{b.boardClearFilters}</Text>
            </Pressable>
          ) : null}
        </View>

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

        <View style={styles.filterRow}>
          <SearchableSelect
            style={styles.filterCell}
            options={brandOptions}
            value={brandId}
            onChange={v => { resetBoard(); setBrandId(v) }}
            placeholder={b.boardFilterBrandPlaceholder}
          />
          <SearchableSelect
            style={styles.filterCell}
            options={locationOptions}
            value={locationId}
            onChange={v => { resetBoard(); setLocationId(v) }}
            placeholder={b.boardFilterAreaPlaceholder}
          />
        </View>
      </View>

      {!loading && !failed ? (
        <Text style={[styles.count, dirStyle]}>{countLabel(total)}</Text>
      ) : null}

      {notice ? (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={18} color={colors.yd} />
          <Text style={[styles.noticeText, dirStyle]}>{notice}</Text>
        </View>
      ) : null}
    </View>
  )

  const empty = loading ? (
    <View style={styles.center}><ActivityIndicator color={colors.y} /></View>
  ) : failed ? (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.g400} />
      <Text style={[styles.cardBody, dirStyle]}>{b.boardLoadFailed}</Text>
      <Button label={b.retry} variant="dk" size="md" onPress={() => { resetBoard(); void loadPage(1, false) }} />
    </View>
  ) : (
    <View style={styles.center}>
      <Ionicons name="search-outline" size={40} color={colors.g400} />
      <Text style={[styles.cardBody, dirStyle]}>{b.boardEmpty}</Text>
    </View>
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
    <SafeAreaView style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
      <View style={styles.header}>
        {topBar}
        <Text style={[styles.sub, dirStyle]}>{b.boardSubtitle}</Text>
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
              style={({ pressed }) => [styles.ghostPill, pressed && styles.pressed]}
            >
              <Text style={styles.ghostPillText}>{b.myOffersTitle}</Text>
            </Pressable>
          ) : null}
          {/* Geeko finds lost its tab to this board, so it's reachable from here. */}
          {userType ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(tabs)/bro-finds' as never)}
              style={({ pressed }) => [styles.ghostPill, pressed && styles.pressed]}
            >
              <Text style={styles.ghostPillText}>{b.foundNavLink}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <CategoryBar
        categories={categories}
        activeCategoryId={categoryId ? Number(categoryId) : null}
        onSelect={id => {
          const v = id == null ? '' : String(id)
          if (v === categoryId) return
          resetBoard()
          setCategoryId(v)
        }}
        allLabel={b.allCategories}
      />

      <View style={styles.content}>
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={({ item }) => <BroBoardCard item={item} onMakeOffer={() => makeOffer(item)} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (!failed) loadMore() }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.y} />}
        />
      </View>
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
  safe: { flex: 1, backgroundColor: colors.dk },
  header: {
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.white },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.72)' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  geekoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.y,
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingStart: 5,
    paddingEnd: 14,
    ...shadow.ss,
  },
  geekoText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.dk },
  geekoStar: { fontFamily: fonts.bold, fontSize: 13, color: colors.dk },
  ghostPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  ghostPillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  pressed: { opacity: 0.85 },
  content: {
    flex: 1,
    backgroundColor: colors.g100,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  listHeader: { gap: spacing.md, marginBottom: spacing.md },

  // Filter card — same chrome as the Products tab.
  filterCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...shadow.ss },
  filterCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  filterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  filterTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.g900 },
  filterCountPill: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: spacing.xs,
  },
  filterCountText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: colors.dk },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.g100,
  },
  resetBtnText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.g600 },
  sortRow: { flexDirection: 'row', backgroundColor: colors.g100, borderRadius: radius.full, padding: 3 },
  sortBtn: { flex: 1, alignItems: 'center', borderRadius: radius.full, paddingVertical: 7 },
  sortBtnOn: { backgroundColor: colors.dk },
  sortText: { fontFamily: fonts.bold, fontSize: 13, color: colors.g500 },
  sortTextOn: { color: colors.white },
  filterRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  filterCell: { flex: 1 },

  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.dk },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.md,
    padding: 12,
  },
  noticeText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, color: colors.dk },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  footer: { gap: spacing.sm, alignItems: 'stretch', marginTop: spacing.xs },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadow.ss },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.dk },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.g600, textAlign: 'center' },
})
