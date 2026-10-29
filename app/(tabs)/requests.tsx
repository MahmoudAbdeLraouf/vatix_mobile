import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
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
import { FilterCombobox } from '@/components/FilterCombobox'
import { Button } from '@/components/ui/Button'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

type Sort = 'newest' | 'budget'

/** Public board of buyer requests that sellers can answer with an offer. Mirrors the website /requests. */
export default function RequestsTab() {
  const { locale, t, isRtl, setLocale } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const b = t.bro
  const ar = locale === 'ar'
  const geekoHint = ar ? 'قول لجيكو عايز إيه والعروض توصلك' : 'Tell Geeko what you want and get offers'
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
  // Home's "Client Requests" strip deep-links here with ?offer=<id> to open the sheet.
  const { offer: offerParam, model: modelParam } = useLocalSearchParams<{ offer?: string; model?: string }>()

  useEffect(() => {
    if (!offerParam || authLoading) return
    const id = Number(offerParam)
    router.setParams({ offer: undefined, model: undefined })
    if (!id || !userType) return
    setSheet({ id, modelText: modelParam || undefined })
  }, [offerParam, modelParam, authLoading, userType])

  useEffect(() => {
    getCategories().then(c => setCategories(c.filter(x => x.isActive))).catch(() => {})
    getBrands().then(br => setBrands(br.filter(x => x.isActive))).catch(() => {})
    getLocations().then(l => setLocations(l.filter(x => x.isActive))).catch(() => {})
  }, [])

  const brandOptions = useMemo(
    () => brands.map(br => ({ value: String(br.id), label: localeName(br.translations, locale) })),
    [brands, locale],
  )
  const locationOptions = useMemo(
    () => locations.map(l => ({ value: String(l.id), label: localeName(l.translations, locale) })),
    [locations, locale],
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
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/bro/new', params: { source: 'nav' } } as never)}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      >
        <View style={styles.bannerAvatar}>
          <BroAvatar size={40} />
        </View>
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerTitle, dirStyle]} numberOfLines={1}>{b.boardAskGeeko} ✦</Text>
          <Text style={[styles.bannerSub, dirStyle]} numberOfLines={1}>{geekoHint}</Text>
        </View>
        <View style={styles.bannerGo}>
          <Ionicons name={isRtl ? 'arrow-back' : 'arrow-forward'} size={18} color={colors.y} />
        </View>
      </Pressable>

      <View style={styles.filterCard}>
        <View style={styles.sortRow}>
          {(['newest', 'budget'] as const).map(s => {
            const on = sort === s
            return (
              <Pressable
                key={s}
                onPress={() => { if (on) return; resetBoard(); setSort(s) }}
                style={[styles.sortBtn, on && styles.sortBtnOn]}
              >
                <Ionicons
                  name={s === 'newest' ? 'time-outline' : 'cash-outline'}
                  size={15}
                  color={on ? colors.y : colors.muted}
                />
                <Text style={[styles.sortText, on && styles.sortTextOn]}>{s === 'newest' ? b.sortNewest : b.sortBudget}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.filterRow}>
          <FilterCombobox
            style={styles.filterCell}
            options={brandOptions}
            value={brandId}
            onChange={v => { if (v === brandId) return; resetBoard(); setBrandId(v) }}
            placeholder={b.boardAllBrands}
          />
          <FilterCombobox
            style={styles.filterCell}
            options={locationOptions}
            value={locationId}
            onChange={v => { if (v === locationId) return; resetBoard(); setLocationId(v) }}
            placeholder={b.boardAllAreas}
          />
        </View>
      </View>

      {/* Offer quota sits with the board it applies to, away from the Ask-Geeko banner. */}
      {userType === 'client' && usage ? <BroUsageMeter usage={usage} style={styles.meter} upgrade /> : null}

      {!loading && !failed ? (
        <View style={styles.resultsRow}>
          <Text style={[styles.count, dirStyle]}>{countLabel(total)}</Text>
          {hasFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={15} color={colors.muted} />
              <Text style={styles.clearText}>{b.boardClearFilters}</Text>
            </Pressable>
          ) : null}
        </View>
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
      <Ionicons name="cloud-offline-outline" size={40} color={colors.subtle} />
      <Text style={[styles.cardBody, dirStyle]}>{b.boardLoadFailed}</Text>
      <Button label={b.retry} variant="dk" size="md" onPress={() => { resetBoard(); void loadPage(1, false) }} />
    </View>
  ) : (
    <View style={styles.center}>
      <Ionicons name="search-outline" size={40} color={colors.subtle} />
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
        <Text style={[styles.sub, dirStyle]} numberOfLines={2}>{b.boardSubtitle}</Text>
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

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.hero },
  header: {
    backgroundColor: colors.hero,
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
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.7)' },
  pressed: { opacity: 0.88 },
  content: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  listHeader: { gap: spacing.md, marginBottom: spacing.md },

  // Ask-Geeko banner — the board's one call to action.
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.y,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingStart: 12,
    paddingEnd: 14,
    ...shadow.ss,
  },
  bannerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBody: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 22, color: colors.dk },
  bannerSub: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 18, color: 'rgba(26,37,64,0.72)' },
  bannerGo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
  },

  meter: { marginBottom: 0, borderWidth: dark ? 1 : 0, borderRadius: radius.lg, ...(dark ? null : shadow.ss) },

  // Sort + brand/area filters.
  filterCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 10,
    gap: 10,
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.ss),
  },
  sortRow: { flexDirection: 'row', backgroundColor: colors.placeholder, borderRadius: radius.full, padding: 4, gap: 4 },
  sortBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingVertical: 8,
  },
  sortBtnOn: { backgroundColor: colors.fab },
  sortText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.muted },
  sortTextOn: { color: colors.white },
  filterRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  filterCell: { flex: 1 },

  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: -spacing.xs,
  },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearText: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 18, color: colors.muted },
  count: { fontFamily: fonts.extraBold, fontSize: 14, lineHeight: 20, color: colors.heading },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.yellowBg,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.md,
    padding: 12,
  },
  noticeText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 20, color: colors.heading },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  footer: { gap: spacing.sm, alignItems: 'stretch', marginTop: spacing.xs },
  err: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.ss),
  },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.heading },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
})
