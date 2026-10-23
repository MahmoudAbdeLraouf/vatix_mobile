import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import {
  getBrands,
  getCategories,
  getLocations,
  getProducts,
  getSpotlightStores,
  imgUrl,
  localeName,
  Brand,
  Category,
  LocationNode,
  Product,
  Store,
} from '@/lib/api'
import { ProductCard } from '@/components/ProductCard'
import { MessagesBell } from '@/components/MessagesBell'
import { CategoryBar } from '@/components/CategoryBar'
import { FilterCombobox, ComboOption } from '@/components/FilterCombobox'
import { trackSearch } from '@/lib/analytics'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { SkeletonProductRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { BroEntryCard } from '@/components/bro/BroEntryCard'
import { ErrorState } from '@/components/ui/ErrorState'

type SortValue = 'newest' | 'oldest' | 'price_asc' | 'price_desc'

// Height of one product row cell (131px card + spacing.md gap). Re-measured from
// the first real cell at runtime; this is just the starting guess.
const DEFAULT_ROW_PITCH = 147
const BACKDROP_ROWS = Math.ceil(Dimensions.get('window').height / 131) + 2

type CellLayout = { index: number; y: number; height: number }

type ProductCellProps = {
  cellKey: string
  index: number
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onLayout?: (e: LayoutChangeEvent) => void
  onFocusCapture?: (e: any) => void
}

function queryKey(
  q: string,
  catId?: number,
  brId?: number,
  locId?: number,
  s?: SortValue,
  minP?: string,
  maxP?: string,
) {
  return JSON.stringify([q, catId, brId, locId, s, minP, maxP])
}

export default function ProductsScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const params = useLocalSearchParams<{ categoryId?: string; brandId?: string; search?: string }>()

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState(params.search ?? '')
  const [categoryId, setCategoryId] = useState<number | undefined>(
    params.categoryId ? Number(params.categoryId) : undefined,
  )
  const [brandId, setBrandId] = useState<number | undefined>(
    params.brandId ? Number(params.brandId) : undefined,
  )
  const [locationId, setLocationId] = useState<number | undefined>()
  const [sort, setSort] = useState<SortValue | undefined>(undefined)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  // Query key of the last page-1 fetch that actually landed; lets the empty-state
  // Bro card wait until the empty list belongs to what is currently typed/filtered.
  const [settledKey, setSettledKey] = useState<string | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [spotlightStores, setSpotlightStores] = useState<Store[]>([])

  useEffect(() => {
    getCategories()
      .then(cats => setCategories(cats.filter(c => c.isActive)))
      .catch(() => {})
    getBrands()
      .then(bs => setBrands(bs.filter(b => b.isActive)))
      .catch(() => {})
    getLocations('governorate')
      .then(locs => setLocations(locs.filter(l => l.isActive)))
      .catch(() => {})
    getSpotlightStores(10)
      .then(setSpotlightStores)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setCategoryId(params.categoryId ? Number(params.categoryId) : undefined)
    setBrandId(params.brandId ? Number(params.brandId) : undefined)
    if (params.search !== undefined) setSearch(params.search)
  }, [params.categoryId, params.brandId, params.search])

  const currentKey = queryKey(search, categoryId, brandId, locationId, sort, minPrice, maxPrice)

  const fetchProducts = useCallback(
    async (
      p: number,
      q: string,
      catId?: number,
      brId?: number,
      locId?: number,
      s?: SortValue,
      minP?: string,
      maxP?: string,
    ) => {
      if (p === 1) setLoading(true)
      else setLoadingMore(true)
      if (p === 1) setError(null)
      try {
        const res = await getProducts({
          page: p,
          limit: 20,
          q: q || undefined,
          categoryId: catId,
          brandId: brId,
          locationId: locId,
          sort: s,
          minPrice: minP ? parseFloat(minP) : undefined,
          maxPrice: maxP ? parseFloat(maxP) : undefined,
          storeFirst: true,
        })
        setProducts(prev => (p === 1 ? res.items : [...prev, ...res.items]))
        setTotalPages(res.meta.pages)
        if (p === 1) setSettledKey(queryKey(q, catId, brId, locId, s, minP, maxP))
        if (p === 1 && q.trim()) trackSearch(q, res.meta.total === 0)
      } catch (e) {
        if (p === 1) {
          setError(e as Error)
          setProducts([])
        }
      } finally {
        if (p === 1) setLoading(false)
        else setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchProducts(1, search, categoryId, brandId, locationId, sort, minPrice, maxPrice)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, categoryId, brandId, locationId, sort, minPrice, maxPrice, fetchProducts])

  function loadMore() {
    if (loadingMore || page >= totalPages) return
    const next = page + 1
    setPage(next)
    fetchProducts(next, search, categoryId, brandId, locationId, sort, minPrice, maxPrice)
  }

  const brandOptions = useMemo<ComboOption[]>(
    () => brands.map(b => ({ value: String(b.id), label: localeName(b.translations, locale) })),
    [brands, locale],
  )
  const locationOptions = useMemo<ComboOption[]>(
    () => locations.map(l => ({ value: String(l.id), label: localeName(l.translations, locale) })),
    [locations, locale],
  )

  const brandPlaceholder = locale === 'ar' ? 'كل الماركات' : 'All Brands'
  const locationPlaceholder = locale === 'ar' ? 'كل المحافظات' : 'All Locations'

  const activeFilterCount =
    (brandId ? 1 : 0) + (locationId ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0
  const filtersLabel = locale === 'ar' ? 'الفلاتر' : 'Filters'
  const resetLabel = locale === 'ar' ? 'مسح الكل' : 'Clear all'
  const resultsForLabel = locale === 'ar' ? 'نتائج' : 'Results for'

  function resetFilters() {
    setBrandId(undefined)
    setLocationId(undefined)
    setSort(undefined)
    setMinPrice('')
    setMaxPrice('')
  }

  const activeBrand = brands.find(b => b.id === brandId)
  const activeLocation = locations.find(l => l.id === locationId)

  const heroTitle = search.trim() ? `🔍 ${resultsForLabel} "${search.trim()}"` : null

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => <ProductCard product={item} variant="row" />,
    [],
  )

  // ── Fast-fling handling ───────────────────────────────────────────────
  // A hard fling can outrun how fast the list mounts rows, leaving blank
  // space. Two layers deal with it:
  //  1. A skeleton backdrop sits behind the list and scrolls in step with
  //     the rows, so any not-yet-mounted area shows row placeholders.
  //  2. If the fling still runs past the last mounted row, momentum is
  //     stopped so the rows can catch up before the user keeps scrolling.
  const listRef = useRef<FlatList<Product>>(null)
  const scrollY = useRef(new Animated.Value(0)).current
  const headerH = useRef(new Animated.Value(0)).current
  const [rowPitch, setRowPitch] = useState(DEFAULT_ROW_PITCH)
  const cellLayouts = useRef(new Map<string, CellLayout>()).current
  const momentumRef = useRef(false)
  const lastYRef = useRef(0)
  const productCountRef = useRef(0)
  productCountRef.current = products.length

  // Stable cell wrapper: records each mounted row's position so onScroll knows
  // where the rendered area ends. Also makes every row (and the gap under it)
  // opaque so the skeleton backdrop only shows through unmounted space.
  const CellRenderer = useMemo(
    () =>
      function ProductCell({ cellKey, index, children, style, onLayout, onFocusCapture }: ProductCellProps) {
        useEffect(() => () => {
          cellLayouts.delete(cellKey)
        }, [cellKey])
        return (
          <View
            style={[style, styles.cell]}
            // RN's View types omit onFocusCapture, but VirtualizedList relies on it.
            {...({ onFocusCapture } as object)}
            onLayout={e => {
              const { y, height } = e.nativeEvent.layout
              cellLayouts.set(cellKey, { index, y, height })
              if (index === 0 && height > 0) {
                setRowPitch(prev => (Math.abs(prev - height) > 0.5 ? height : prev))
              }
              onLayout?.(e)
            }}
          >
            {children}
          </View>
        )
      },
    [cellLayouts],
  )

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y
      const goingDown = y > lastYRef.current
      lastYRef.current = y
      if (!momentumRef.current || cellLayouts.size === 0) return

      let first: CellLayout | undefined
      let last: CellLayout | undefined
      for (const c of cellLayouts.values()) {
        if (!first || c.index < first.index) first = c
        if (!last || c.index > last.index) last = c
      }
      if (!first || !last) return

      const viewportBottom = y + e.nativeEvent.layoutMeasurement.height
      const outranDown =
        goingDown && last.index < productCountRef.current - 1 && viewportBottom > last.y + last.height
      const outranUp = !goingDown && first.index > 0 && y < first.y
      if (outranDown || outranUp) {
        momentumRef.current = false
        listRef.current?.scrollToOffset({ offset: y, animated: false })
      }
    },
    [cellLayouts],
  )

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: handleScroll,
      }),
    [scrollY, handleScroll],
  )

  // Shift the backdrop so its placeholders line up with where real rows sit.
  const backdropShift = useMemo(
    () =>
      Animated.multiply(
        Animated.modulo(Animated.subtract(scrollY, headerH), rowPitch),
        -1,
      ),
    [scrollY, headerH, rowPitch],
  )

  // Memoize the list header so unrelated re-renders (products loading, pagination,
  // errors) don't rebuild the header JSX — which would otherwise force the FlatList
  // to reconcile & re-measure it, producing the "items scroll up and down" jitter.
  const listHeader = useMemo(() => {
    const dir = {
      writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    }
    return (
    <View
      style={styles.listHeader}
      onLayout={e => headerH.setValue(e.nativeEvent.layout.height)}
    >
      {/* Covers the iOS pull-down bounce so the skeleton backdrop never peeks above the header. */}
      <View style={styles.bounceTop} pointerEvents="none" />
      {/* ─── Spotlight stores rail ─────────────────────────────────
          Mirrors website /products placement: directly below the sticky
          category strip, above the hero block. Bleeds to the screen edges
          by cancelling out `list`'s horizontal padding. */}
      {spotlightStores.length > 0 && (
        <View style={styles.railSection}>
          <View style={styles.railHeader}>
            <Text style={[styles.railTitle, dir]}>
              {locale === 'ar' ? '⭐ متاجر مميّزة' : '⭐ Featured Stores'}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/stores')} hitSlop={8}>
              <Text style={[styles.railLink, dir]}>
                {locale === 'ar' ? 'عرض الكل' : 'View all'}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railList}
          >
            {spotlightStores.map((store) => {
              const cover = imgUrl(store.storeProfile?.cover, { w: 340 })
              const logo = imgUrl(store.storeProfile?.logo, { w: 68 })
              const name = store.storeProfile?.name ?? ''
              return (
                <Pressable
                  key={store.id}
                  onPress={() => router.push(`/store/${store.id}`)}
                  style={({ pressed }) => [
                    styles.spotCard,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={styles.spotCover}>
                    {cover ? (
                      <Image
                        source={{ uri: cover }}
                        style={styles.spotCoverImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                        recyclingKey={`spot-cover-${store.id}`}
                      />
                    ) : (
                      <View style={styles.spotCoverPlaceholder}>
                        <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.25)" />
                      </View>
                    )}
                    <View style={[styles.spotBadge, store.isPromoted === true ? styles.spotBadgePromoted : styles.spotBadgeStd]}>
                      <Text style={[styles.spotBadgeText, styles.spotBadgeTextStd]}>
                        {store.isPromoted === true ? t.featured : locale === 'ar' ? '🏪 متجر' : '🏪 Store'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.spotBody}>
                    <View style={styles.spotLogo}>
                      {logo ? (
                        <Image
                          source={{ uri: logo }}
                          style={styles.spotLogoImg}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                          transition={120}
                          recyclingKey={`spot-logo-${store.id}`}
                        />
                      ) : (
                        <Text style={styles.spotLogoFallback}>🏪</Text>
                      )}
                    </View>
                    <Text
                      style={[styles.spotName, dir]}
                      numberOfLines={2}
                    >
                      {name}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* ─── Hero block ────────────────────────────────────────────── */}
      <View style={styles.hero}>
        {heroTitle ? (
          <Text style={[styles.heroTitle, { textAlign: 'auto' }]} numberOfLines={2}>
            {heroTitle}
          </Text>
        ) : null}
        <View style={styles.heroMetaRow}>
          <TouchableOpacity
            style={styles.postAdBtn}
            onPress={() => router.push('/products/new')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={15} color={colors.dk} />
            <Text style={styles.postAdText}>{t.postFreeAd}</Text>
          </TouchableOpacity>
          {/* Always visible, like the post-ad button */}
          <View style={styles.broPillSlot}>
            <BroEntryCard
              variant="pill"
              context={{
                model: search,
                categoryId,
                brandId,
                locationId,
                budgetMax: maxPrice.trim() || null,
              }}
            />
          </View>
        </View>
      </View>

      {/* ─── Active filter chips (only when set) ──────────────────── */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipStrip}
        >
          {activeBrand && (
            <TouchableOpacity
              style={styles.activeChip}
              activeOpacity={0.7}
              onPress={() => setBrandId(undefined)}
            >
              <Text style={styles.activeChipText} numberOfLines={1}>
                {localeName(activeBrand.translations, locale)}
              </Text>
              <Ionicons name="close" size={13} color={colors.dk} />
            </TouchableOpacity>
          )}
          {activeLocation && (
            <TouchableOpacity
              style={styles.activeChip}
              activeOpacity={0.7}
              onPress={() => setLocationId(undefined)}
            >
              <Text style={styles.activeChipText} numberOfLines={1}>
                {localeName(activeLocation.translations, locale)}
              </Text>
              <Ionicons name="close" size={13} color={colors.dk} />
            </TouchableOpacity>
          )}
          {minPrice ? (
            <TouchableOpacity
              style={styles.activeChip}
              activeOpacity={0.7}
              onPress={() => setMinPrice('')}
            >
              <Text style={styles.activeChipText}>
                {t.from}: {Number(minPrice).toLocaleString()}
              </Text>
              <Ionicons name="close" size={13} color={colors.dk} />
            </TouchableOpacity>
          ) : null}
          {maxPrice ? (
            <TouchableOpacity
              style={styles.activeChip}
              activeOpacity={0.7}
              onPress={() => setMaxPrice('')}
            >
              <Text style={styles.activeChipText}>
                {t.to}: {Number(maxPrice).toLocaleString()}
              </Text>
              <Ionicons name="close" size={13} color={colors.dk} />
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}

      {/* ─── Filters card ──────────────────────────────────────────── */}
      <View style={styles.filterCard}>
        <View style={styles.filterCardHeader}>
          <View style={styles.filterTitleRow}>
            <Ionicons name="options-outline" size={16} color={colors.dk} />
            <Text style={styles.filterTitle}>{filtersLabel}</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterCountPill}>
                <Text style={styles.filterCountPillText}>{activeFilterCount}</Text>
              </View>
            )}
          </View>
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={resetFilters}
              activeOpacity={0.7}
              hitSlop={6}
            >
              <Ionicons name="refresh-outline" size={13} color={colors.g600} />
              <Text style={styles.resetBtnText}>{resetLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Brand + Location row */}
        <View style={styles.filterRow}>
          <FilterCombobox
            style={styles.filterCell}
            options={brandOptions}
            value={brandId ? String(brandId) : ''}
            onChange={v => setBrandId(v ? Number(v) : undefined)}
            placeholder={brandPlaceholder}
          />
          <FilterCombobox
            style={styles.filterCell}
            options={locationOptions}
            value={locationId ? String(locationId) : ''}
            onChange={v => setLocationId(v ? Number(v) : undefined)}
            placeholder={locationPlaceholder}
          />
        </View>

        {/* Price range — two equal flex:1 cells so min/max match brand/location widths. */}
        <View style={styles.filterRow}>
          <View style={styles.filterCell}>
            <TextInput
              style={styles.priceInput}
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              placeholder={t.from}
              placeholderTextColor={colors.g400}
              textAlign="center"
            />
          </View>
          <View style={styles.filterCell}>
            <TextInput
              style={styles.priceInput}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              placeholder={t.to}
              placeholderTextColor={colors.g400}
              textAlign="center"
            />
          </View>
        </View>
      </View>
    </View>
    )
  }, [
    heroTitle,
    t,
    activeFilterCount,
    activeBrand,
    activeLocation,
    minPrice,
    maxPrice,
    search,
    categoryId,
    filtersLabel,
    hasActiveFilters,
    resetLabel,
    brandOptions,
    locationOptions,
    brandId,
    locationId,
    brandPlaceholder,
    locationPlaceholder,
    locale,
    spotlightStores,
    isRtl,
  ])

  return (
    <SafeAreaView
      style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]}
      edges={['top']}
    >
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t.products}</Text>
          <View style={styles.titleActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            >
              <Ionicons name="globe-outline" size={20} color={colors.white} />
            </TouchableOpacity>
            <MessagesBell color={colors.white} size={20} style={styles.iconBtn} />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/dashboard/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.g500} />
          <TextInput
            style={[styles.searchInput, { textAlign: 'auto' }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={colors.g400}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.g400} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Sticky category strip ──────────────────────────────────── */}
      <CategoryBar
        categories={categories}
        activeCategoryId={categoryId ?? null}
        onSelect={id => setCategoryId(id ?? undefined)}
        allLabel={t.all}
      />

      {/* ─── Product list ────────────────────────────────────────────── */}
      <View style={styles.content}>
        {loading && products.length === 0 ? (
          // Only show the skeleton on the initial load. On subsequent filter
          // changes we keep the existing list mounted so scroll position, header
          // measurements, and virtualization state are preserved (swapping
          // between the skeleton and FlatList caused the "items jumping up and
          // down" jitter as the list re-mounted and re-measured every row).
          <View style={styles.list}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonProductRow key={i} />
            ))}
          </View>
        ) : error ? (
          <ErrorState
            kind="network"
            onRetry={() =>
              fetchProducts(1, search, categoryId, brandId, locationId, sort, minPrice, maxPrice)
            }
          />
        ) : (
          <>
          {products.length > 0 && (
            <View style={styles.backdrop} pointerEvents="none">
              <Animated.View style={{ gap: spacing.md, transform: [{ translateY: backdropShift }] }}>
                {Array.from({ length: BACKDROP_ROWS }).map((_, i) => (
                  <SkeletonProductRow key={i} />
                ))}
              </Animated.View>
            </View>
          )}
          <Animated.FlatList
            ref={listRef}
            data={products}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={styles.listContent}
            CellRendererComponent={CellRenderer}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <>
                <EmptyState title={t.noResults} subtitle={t.notFoundHint} />
                {search.trim().length > 0 && !loading && settledKey === currentKey && (
                  <BroEntryCard
                    variant="search"
                    context={{
                      model: search,
                      categoryId,
                      brandId,
                      locationId,
                      budgetMax: maxPrice.trim() || null,
                    }}
                  />
                )}
              </>
            }
            renderItem={renderProduct}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              products.length > 0 ? (
                <View style={styles.footer}>
                  {(loadingMore || page < totalPages) && (
                    <>
                      <SkeletonProductRow />
                      <SkeletonProductRow />
                    </>
                  )}
                  <View style={styles.bounceBottom} pointerEvents="none" />
                </View>
              ) : null
            }
            ListFooterComponentStyle={styles.footerWrap}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={12}
            windowSize={15}
            updateCellsBatchingPeriod={30}
            // Slightly shorter iOS flings (default 0.998); Android keeps its default.
            decelerationRate={Platform.OS === 'ios' ? 0.995 : 'normal'}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onScrollBeginDrag={() => {
              momentumRef.current = false
            }}
            onMomentumScrollBegin={() => {
              momentumRef.current = true
            }}
            onMomentumScrollEnd={() => {
              momentumRef.current = false
            }}
          />
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dk },
  content: {
    flex: 1,
    backgroundColor: colors.g100,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.white,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },

  // ── List header (hero + filters) ────────────────────────────────────
  // Opaque so the skeleton backdrop never shows through the header area.
  listHeader: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.g100,
  },
  bounceTop: {
    position: 'absolute',
    top: -1000,
    height: 1000,
    left: -spacing.lg,
    right: -spacing.lg,
    backgroundColor: colors.g100,
  },

  // Hero block — mirrors the website's dark→light transition band.
  hero: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    lineHeight: 30,
    color: colors.dk,
    letterSpacing: -0.3,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  postAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.y,
    ...shadow.ss,
  },
  postAdText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.dk,
  },
  // Content-sized, but shrinks (text scales down) instead of wrapping to a second line on narrow phones.
  broPillSlot: {
    flexShrink: 1,
    minWidth: 0,
  },

  // Active-filter chip strip.
  chipStrip: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
    paddingStart: spacing.md,
    paddingEnd: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
  },
  activeChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.yd,
    flexShrink: 1,
  },

  // ── Filters card ────────────────────────────────────────────────────
  filterCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.ss,
  },
  filterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.g900,
  },
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
  filterCountPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.dk,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.g100,
  },
  resetBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  filterCell: {
    flex: 1,
  },

  // ── List ────────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  cell: {
    paddingBottom: spacing.md,
    backgroundColor: colors.g100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  footerWrap: {
    flexGrow: 1,
    backgroundColor: colors.g100,
  },
  footer: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  bounceBottom: {
    position: 'absolute',
    bottom: -1000,
    height: 1000,
    left: -spacing.lg,
    right: -spacing.lg,
    backgroundColor: colors.g100,
  },

  // Height/border/radius mirror FilterCombobox.chip so min/max match the dropdowns.
  priceInput: {
    height: 42,
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g900,
    paddingHorizontal: spacing.sm,
  },

  // ── Spotlight stores rail ──────────────────────────────────────────
  // Sits at the very top of the FlatList header. Cancels out the parent
  // `list` horizontal padding (marginHorizontal: -spacing.lg) so the rail
  // bleeds flush with the screen edges — cards can scroll past the safe
  // zone while the header row + link stay inset via railHeader padding.
  railSection: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.sm,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm + 2,
    gap: spacing.sm,
  },
  railTitle: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.g900,
    letterSpacing: 0.1,
  },
  railLink: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.dk,
  },
  railList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  spotCard: {
    width: 170,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...shadow.ss,
  },
  spotCover: {
    position: 'relative',
    height: 90,
    backgroundColor: colors.g100,
  },
  spotCoverImg: {
    width: '100%',
    height: '100%',
  },
  spotCoverPlaceholder: {
    flex: 1,
    backgroundColor: colors.dk2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotBadge: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  spotBadgeStd: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  spotBadgePromoted: {
    backgroundColor: colors.y,
  },
  spotBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  spotBadgeTextStd: {
    color: colors.dk,
  },
  spotBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  spotLogo: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.g200,
    padding: 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spotLogoImg: {
    width: '100%',
    height: '100%',
  },
  spotLogoFallback: {
    fontSize: 18,
  },
  spotName: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.dk,
    minHeight: 30,
  },
})
