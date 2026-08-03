import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import {
  getBrands,
  getCategories,
  getLocations,
  getProducts,
  localeName,
  Brand,
  Category,
  LocationNode,
  Product,
} from '@/lib/api'
import { ProductCard } from '@/components/ProductCard'
import { MessagesBell } from '@/components/MessagesBell'
import { CategoryBar } from '@/components/CategoryBar'
import { FilterCombobox, ComboOption } from '@/components/FilterCombobox'
import { trackSearch } from '@/lib/analytics'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

type SortValue = 'newest' | 'oldest' | 'price_asc' | 'price_desc'

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
  const [sort, setSort] = useState<SortValue>('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [locations, setLocations] = useState<LocationNode[]>([])

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
  }, [])

  useEffect(() => {
    setCategoryId(params.categoryId ? Number(params.categoryId) : undefined)
    setBrandId(params.brandId ? Number(params.brandId) : undefined)
    if (params.search !== undefined) setSearch(params.search)
  }, [params.categoryId, params.brandId, params.search])

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
        })
        setProducts(prev => (p === 1 ? res.items : [...prev, ...res.items]))
        setTotalPages(res.meta.pages)
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
    setSort('newest')
    setMinPrice('')
    setMaxPrice('')
  }

  const activeBrand = brands.find(b => b.id === brandId)
  const activeLocation = locations.find(l => l.id === locationId)

  const heroTitle = search.trim() ? `🔍 ${resultsForLabel} "${search.trim()}"` : null

  const listHeader = (
    <View style={styles.listHeader}>
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
            onPress={() => router.push('/products/add')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={15} color={colors.dk} />
            <Text style={styles.postAdText}>{t.postFreeAd}</Text>
          </TouchableOpacity>
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
        {loading ? (
          <View style={styles.list}>
            <SkeletonGrid count={6} />
          </View>
        ) : error ? (
          <ErrorState
            kind="network"
            onRetry={() =>
              fetchProducts(1, search, categoryId, brandId, locationId, sort, minPrice, maxPrice)
            }
          />
        ) : (
          <FlatList
            data={products}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={styles.list}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={<EmptyState title={t.noResults} subtitle={t.notFoundHint} />}
            renderItem={({ item }) => (
              <ProductCard product={item} variant="row" />
            )}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={colors.y} style={styles.more} /> : null
            }
            keyboardShouldPersistTaps="handled"
          />
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
  listHeader: {
    gap: spacing.md,
    marginBottom: spacing.md,
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
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  postAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
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
  more: { paddingVertical: spacing.lg },

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
})
