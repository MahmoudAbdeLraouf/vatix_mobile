import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SvgXml } from 'react-native-svg'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import {
  Brand,
  Category,
  getFeaturedStores,
  getCategories,
  getBrands,
  getProducts,
  getRateAppEnabled,
  getSiteStats,
  getStores,
  imgUrl,
  localeName,
  Product,
  SiteStats,
  Store,
} from '@/lib/api'
import { markActionSeen } from '@/lib/auth'
import {
  bumpEngagement,
  markShown as markRateAppShown,
  shouldShowRateApp,
  type Audience,
} from '@/lib/rate-app-engagement'
import { getBrandIcon } from '@/lib/brand-icons'
import { getCategoryIcon, type IoniconName as SharedIoniconName } from '@/lib/category-icons'
import { IS_IOS } from '@/lib/platform'
import { ProductCard } from '@/components/ProductCard'
import { StoreCard } from '@/components/StoreCard'
import { MessagesBell } from '@/components/MessagesBell'
import { RateAppDialog } from '@/components/RateAppDialog'
import { Logo } from '@/components/ui/Logo'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = Math.floor((SCREEN_W - spacing.lg * 2 - spacing.md) / 2)
const BRAND_W = Math.floor((SCREEN_W - spacing.lg * 2 - spacing.md * 2) / 3)
const PROMO_W = SCREEN_W - spacing.lg * 2

type IoniconName = SharedIoniconName

// ─── Promo Carousel Data ──────────────────────────────────────────────────────

interface PromoBanner {
  id: number
  bg: string
  titleColor: string
  subColor: string
  accentColor: string
  btnBg: string
  btnText: string
  iconBg: string
  icon: IoniconName
  badgeAr: string
  badgeEn: string
  titleKey: 'promoAddTitle' | 'promoDealsTitle' | 'promoStoresTitle'
  subKey: 'promoAddSubtitle' | 'promoDealsSubtitle' | 'promoStoresSubtitle'
  btnKey: 'promoAddCta' | 'promoDealsCta' | 'promoStoresCta'
  onPress: () => void
}

const PROMO_BANNERS: PromoBanner[] = [
  {
    id: 1,
    bg: colors.dk,
    titleColor: colors.y,
    subColor: 'rgba(255,255,255,0.65)',
    accentColor: colors.y,
    btnBg: colors.y,
    btnText: colors.dk,
    iconBg: 'rgba(245,184,0,0.15)',
    icon: 'add-circle-outline',
    badgeAr: 'بائع',
    badgeEn: 'Seller',
    titleKey: 'promoAddTitle',
    subKey: 'promoAddSubtitle',
    btnKey: 'promoAddCta',
    onPress: () => router.push('/products/add'),
  },
  {
    id: 2,
    bg: colors.y,
    titleColor: colors.dk,
    subColor: 'rgba(26,37,64,0.65)',
    accentColor: colors.dk,
    btnBg: colors.dk,
    btnText: colors.y,
    iconBg: 'rgba(26,37,64,0.12)',
    icon: 'grid-outline',
    badgeAr: 'تسوّق',
    badgeEn: 'Shop',
    titleKey: 'promoDealsTitle',
    subKey: 'promoDealsSubtitle',
    btnKey: 'promoDealsCta',
    onPress: () => router.push('/(tabs)/products'),
  },
  {
    id: 3,
    bg: colors.dk3,
    titleColor: colors.white,
    subColor: 'rgba(255,255,255,0.6)',
    accentColor: colors.y,
    btnBg: colors.y,
    btnText: colors.dk,
    iconBg: 'rgba(245,184,0,0.15)',
    icon: 'storefront-outline',
    badgeAr: 'موثوق',
    badgeEn: 'Trusted',
    titleKey: 'promoStoresTitle',
    subKey: 'promoStoresSubtitle',
    btnKey: 'promoStoresCta',
    onPress: () => router.push('/(tabs)/stores'),
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function PromoCard({ item }: { item: PromoBanner }) {
  const { t, isRtl } = useLocale()
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={item.onPress}
      style={[promoStyles.card, { backgroundColor: item.bg, width: PROMO_W }]}
    >
      {/* Background decorative circles */}
      <View style={[promoStyles.bgCircle, { backgroundColor: item.accentColor }]} />
      <View style={[promoStyles.bgCircleSmall, { backgroundColor: item.accentColor }]} />

      <View style={promoStyles.row}>
        {/* Text column */}
        <View style={promoStyles.textCol}>
          <View style={[promoStyles.badge, { backgroundColor: item.btnBg }]}>
            <Text style={[promoStyles.badgeText, { color: item.btnText }]}>
              {isRtl ? item.badgeAr : item.badgeEn}
            </Text>
          </View>
          <Text style={[promoStyles.title, { color: item.titleColor }]} numberOfLines={2}>
            {t[item.titleKey]}
          </Text>
          <Text style={[promoStyles.sub, { color: item.subColor }]} numberOfLines={2}>
            {t[item.subKey]}
          </Text>
          <View style={[promoStyles.btn, { backgroundColor: item.btnBg }]}>
            <Text style={[promoStyles.btnText, { color: item.btnText }]}>
              {t[item.btnKey]}
            </Text>
            <Ionicons
              name={isRtl ? 'arrow-back-outline' : 'arrow-forward-outline'}
              size={13}
              color={item.btnText}
            />
          </View>
        </View>

        {/* Icon column */}
        <View style={promoStyles.iconCol}>
          <View style={[promoStyles.iconCircle, { backgroundColor: item.iconBg }]}>
            <Ionicons name={item.icon} size={38} color={item.titleColor} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const promoStyles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    height: 190,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  bgCircle: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: radius.full,
    top: -70,
    end: -70,
    opacity: 0.1,
  },
  bgCircleSmall: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: radius.full,
    bottom: -40,
    start: -30,
    opacity: 0.07,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing.lg,
    paddingEnd: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 19,
    lineHeight: 26,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    marginTop: 2,
  },
  btnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  iconCol: {
    width: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

function PromoDots({ count, active }: { count: number; active: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[dotStyles.dot, i === active && dotStyles.dotActive]} />
      ))}
    </View>
  )
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: spacing.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.g300,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.y,
  },
})

function BrandCard({ brand, locale, width }: { brand: Brand; locale: string; width: number }) {
  const name = localeName(brand.translations, locale as 'ar' | 'en')
  const logoUrl = imgUrl(brand.logo)
  const icon = getBrandIcon(name)
  return (
    <TouchableOpacity
      style={[brandCardStyles.card, { width }]}
      activeOpacity={0.75}
      onPress={() =>
        router.push({ pathname: '/(tabs)/products', params: { brandId: brand.id } })
      }
    >
      <View style={brandCardStyles.logoWrap}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={brandCardStyles.logo} resizeMode="contain" />
        ) : icon.hasSvg ? (
          <SvgXml xml={icon.xml} width={40} height={40} />
        ) : (
          <Ionicons name="pricetag-outline" size={28} color={colors.dk} />
        )}
      </View>
      <Text style={brandCardStyles.name} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  )
}

const brandCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    ...shadow.sm,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 48, height: 48 },
  name: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.g700, textAlign: 'center' },
})

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  const { t, isRtl } = useLocale()
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.titleAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onMore && (
        <TouchableOpacity onPress={onMore} style={styles.seeAllBtn}>
          <Text style={styles.seeAll}>{t.seeAll}</Text>
          <Ionicons
            name={isRtl ? 'chevron-back-outline' : 'chevron-forward-outline'}
            size={13}
            color={colors.dk}
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

function Section({
  title,
  children,
  onMore,
}: {
  title: string
  children: React.ReactNode
  onMore?: () => void
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} onMore={onMore} />
      {children}
    </View>
  )
}

function ProductRowSeparator() {
  return <View style={styles.productRowSep} />
}

// ─── Category Icon Mapping ────────────────────────────────────────────────────

interface CategoryItem {
  id: number | null
  name: string
  icon: IoniconName
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const { user } = useAuth()

  const [stores, setStores] = useState<Store[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [latestProducts, setLatestProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<SiteStats>({ users: 0, stores: 0, products: 0 })

  const [loading, setLoading] = useState(true)
  const [activePromo, setActivePromo] = useState(0)
  const [search, setSearch] = useState('')
  const [showRateAppDialog, setShowRateAppDialog] = useState(false)

  useEffect(() => {
    Promise.all([
      getFeaturedStores().catch(() => [] as Store[]),
      getCategories().catch(() => [] as Category[]),
      IS_IOS ? Promise.resolve([] as Brand[]) : getBrands().catch(() => [] as Brand[]),
      getProducts({ limit: 8, promoted: true }).catch(() => ({
        items: [] as Product[],
        meta: { total: 0, page: 1, limit: 8, pages: 0 },
      })),
      getProducts({ limit: 12, sort: 'newest' }).catch(() => ({
        items: [] as Product[],
        meta: { total: 0, page: 1, limit: 12, pages: 0 },
      })),
      getStores().catch(() => [] as Store[]),
      getSiteStats().catch(() => ({ users: 0, stores: 0, products: 0 } as SiteStats)),
    ]).then(([s, c, b, fp, lp, allS, st]) => {
      setStores(s)
      setAllStores(allS)
      setCategories([
        { id: null, name: t.all, icon: 'grid-outline' },
        ...c.map(cat => ({
          id: cat.id,
          name: localeName(cat.translations, locale),
          icon: getCategoryIcon(localeName(cat.translations, locale)),
        })),
      ])
      setBrands(b.filter(br => br.isActive))
      const dedupeById = (arr: Product[]) => {
        const seen = new Set<number | string>()
        return arr.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      }
      const featuredSource = fp.items.length > 0 ? fp.items : lp.items.slice(0, 8)
      setFeaturedProducts(dedupeById(featuredSource))
      setLatestProducts(dedupeById(lp.items))
      setStats(st)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await bumpEngagement('session_start')
      const { enabled } = await getRateAppEnabled().catch(() => ({ enabled: false }))
      if (!enabled || cancelled) return
      const audience: Audience = (user?.type as Audience) ?? 'guest'
      const should = await shouldShowRateApp(audience)
      if (should && !cancelled) {
        await markRateAppShown()
        await markActionSeen('rate_app_dialog')
        setShowRateAppDialog(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.type])

  const handlePromoScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    setActivePromo(Math.round(x / (PROMO_W + spacing.md)))
  }, [])

  const submitSearch = useCallback(() => {
    const q = search.trim()
    if (q) {
      router.push({ pathname: '/(tabs)/products', params: { search: q } })
    } else {
      router.push('/(tabs)/products')
    }
  }, [search])

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard product={item} style={styles.productCardFull} />
    ),
    [],
  )
  const productKey = useCallback((p: Product) => String(p.id), [])
  const renderPromo = useCallback(({ item }: { item: PromoBanner }) => <PromoCard item={item} />, [])
  const promoKey = useCallback((p: PromoBanner) => String(p.id), [])
  const renderStore = useCallback(
    ({ item }: { item: Store }) => <StoreCard store={item} style={styles.storeCardWide} />,
    [],
  )
  const storeKey = useCallback((s: Store) => String(s.id), [])

  const listHeader = useMemo(
    () => (
      <>
        {/* Promo Carousel */}
        <View style={styles.promoSection}>
          <FlatList
            horizontal
            data={PROMO_BANNERS}
            keyExtractor={promoKey}
            renderItem={renderPromo}
            contentContainerStyle={styles.promoList}
            showsHorizontalScrollIndicator={false}
            snapToInterval={PROMO_W + spacing.md}
            decelerationRate="fast"
            onScroll={handlePromoScroll}
            scrollEventThrottle={16}
          />
          <PromoDots count={PROMO_BANNERS.length} active={activePromo} />
        </View>

        {/* Category Icons */}
        {categories.length > 1 && (
          <Section title={t.categories} onMore={() => router.push('/(tabs)/products')}>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={c => String(c.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() =>
                    item.id === null
                      ? router.push('/(tabs)/products')
                      : router.push({
                          pathname: '/(tabs)/products',
                          params: { categoryId: String(item.id) },
                        })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryIconWrap}>
                    <Ionicons name={item.icon} size={28} color={colors.blue} />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.categoriesList}
              showsHorizontalScrollIndicator={false}
            />
          </Section>
        )}

        {/* Featured Stores */}
        {stores.length > 0 && (
          <Section title={t.featuredStores} onMore={() => router.push('/(tabs)/stores')}>
            <FlatList
              horizontal
              data={stores}
              keyExtractor={storeKey}
              renderItem={renderStore}
              contentContainerStyle={styles.hList}
              showsHorizontalScrollIndicator={false}
            />
          </Section>
        )}

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <Section
            title={t.featuredProducts}
            onMore={() => router.push({ pathname: '/(tabs)/products', params: { promoted: 'true' } })}
          >
            <View style={styles.productsGrid}>
              {featuredProducts.map(p => (
                <ProductCard key={p.id} product={p} style={styles.productCardFull} />
              ))}
            </View>
          </Section>
        )}

        {/* Latest Products header */}
        {latestProducts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t.latestProducts}
              onMore={() => router.push('/(tabs)/products')}
            />
          </View>
        )}
      </>
    ),
    [
      t,
      activePromo,
      categories,
      stores,
      featuredProducts,
      latestProducts.length,
      handlePromoScroll,
      renderPromo,
      promoKey,
      renderStore,
      storeKey,
    ],
  )

  const listFooter = useMemo(
    () => (
      <>
        {/* All Stores */}
        {allStores.length > 0 && (
          <Section title={t.allStores} onMore={() => router.push('/(tabs)/stores')}>
            <FlatList
              horizontal
              data={allStores}
              keyExtractor={storeKey}
              renderItem={renderStore}
              contentContainerStyle={styles.hList}
              showsHorizontalScrollIndicator={false}
            />
          </Section>
        )}

        {!IS_IOS && brands.length > 0 && (
          <Section title={t.brands}>
            <View style={styles.brandsGrid}>
              {brands.map(b => (
                <BrandCard key={b.id} brand={b} locale={locale} width={BRAND_W} />
              ))}
            </View>
          </Section>
        )}
      </>
    ),
    [t, allStores, brands, locale, renderStore, storeKey],
  )

  return (
    <SafeAreaView style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
      <View style={styles.container}>
        {loading ? (
          <View style={[styles.center, { backgroundColor: colors.g100 }]}>
            <ActivityIndicator color={colors.y} size="large" />
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.titleRow}>
                <Logo size="sm" light />
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="globe-outline" size={20} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => router.push('/dashboard/notifications')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="notifications-outline" size={22} color={colors.white} />
                  </TouchableOpacity>
                  <MessagesBell color={colors.white} style={styles.iconBtn} />
                </View>
              </View>
              {user?.displayName ? (
                <Text style={styles.welcomeText} numberOfLines={1}>
                  {t.welcomeBack} {user.displayName} 👋
                </Text>
              ) : null}
              <View style={styles.heroSearchRow}>
                <View style={styles.heroSearchBar}>
                  <Ionicons name="search-outline" size={20} color={colors.g500} />
                  <TextInput
                    style={[styles.searchInput, { textAlign: 'auto' }]}
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t.search}
                    placeholderTextColor={colors.g400}
                    returnKeyType="search"
                    onSubmitEditing={submitSearch}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={18} color={colors.g400} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.heroSearchBtn}
                  onPress={submitSearch}
                  activeOpacity={0.85}
                >
                  <Ionicons name="search" size={22} color={colors.dk} />
                </TouchableOpacity>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statNum}>
                    {stats.users.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}
                  </Text>
                  <Text style={styles.statLbl}>{t.usersLabel}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statNum}>
                    {stats.stores.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}
                  </Text>
                  <Text style={styles.statLbl}>{t.verifiedStoresLabel}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statNum}>
                    {stats.products.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}
                  </Text>
                  <Text style={styles.statLbl}>{t.activeAds}</Text>
                </View>
              </View>
            </View>
            <View style={styles.content}>
              <FlatList
                data={latestProducts}
                keyExtractor={productKey}
                renderItem={renderProduct}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                ItemSeparatorComponent={ProductRowSeparator}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={9}
              />
            </View>
          </>
        )}
      </View>
      <RateAppDialog
        visible={showRateAppDialog}
        onClose={() => setShowRateAppDialog(false)}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dk },
  container: { flex: 1 },
  content: {
    flex: 1,
    backgroundColor: colors.g100,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  hero: {
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  welcomeText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontFamily: fonts.black,
    fontSize: 15,
    color: colors.y,
    lineHeight: 20,
  },
  statLbl: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    ...shadow.sm,
  },
  heroSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  promoSection: {
    marginTop: spacing.lg,
  },
  promoList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  categoriesList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  categoryItem: {
    alignItems: 'center',
    width: 84,
    gap: spacing.xs,
  },
  categoryIconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.bl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.dk,
    textAlign: 'center',
  },

  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.y,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.g900,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.yl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  seeAll: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.dk,
  },

  hList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  featuredCard: {
    width: 180,
  },

  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  productRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  productRowSep: {
    height: spacing.md,
  },
  productCardFull: {
    width: CARD_W,
  },
  storeCardWide: {
    width: 150,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g500,
  },
  brandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
})
