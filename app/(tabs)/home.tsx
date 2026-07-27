import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
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
  getStores,
  imgUrl,
  localeName,
  Product,
  Store,
} from '@/lib/api'
import { getBrandIcon } from '@/lib/brand-icons'
import { getCategoryIcon, type IoniconName as SharedIoniconName } from '@/lib/category-icons'
import { ProductCard } from '@/components/ProductCard'
import { StoreCard } from '@/components/StoreCard'
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
    badgeEn: 'Verified',
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

function UpgradeBanner() {
  const { t } = useLocale()
  const feats = [t.upgFeat1, t.upgFeat2, t.upgFeat3, t.upgFeat4]
  return (
    <View style={bannerStyles.card}>
      <View style={bannerStyles.header}>
        <View style={bannerStyles.iconWrap}>
          <Ionicons name="storefront-outline" size={22} color={colors.y} />
        </View>
        <View style={bannerStyles.headerText}>
          <Text style={bannerStyles.title}>{t.upgradeBannerTitle}</Text>
          <Text style={bannerStyles.sub}>{t.upgradeBannerSubtitle}</Text>
        </View>
      </View>

      {/* .upg-feats */}
      <View style={bannerStyles.feats}>
        {feats.map((f, i) => (
          <View key={i} style={bannerStyles.feat}>
            <Text style={bannerStyles.featText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* .upg-btns */}
      <View style={bannerStyles.btnRow}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/dashboard')}
          style={bannerStyles.btnY}
        >
          <Text style={bannerStyles.btnYText}>{t.upgradeBannerTitle}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/dashboard')}
          style={bannerStyles.btnOut}
        >
          <Text style={bannerStyles.btnOutText}>{t.viewPlans}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const bannerStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.yl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.y,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: { flex: 1, gap: 3 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.dk },
  sub: { fontFamily: fonts.regular, fontSize: 11, color: colors.g700 },
  feats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  feat: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  featText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.dk,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  btnY: {
    flex: 1,
    backgroundColor: colors.y,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnYText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  btnOut: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.dk,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
})

function Section({
  title,
  children,
  onMore,
}: {
  title: string
  children: React.ReactNode
  onMore?: () => void
}) {
  const { t, isRtl } = useLocale()
  return (
    <View style={styles.section}>
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
      {children}
    </View>
  )
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
  const [totalAds, setTotalAds] = useState(0)

  const [loading, setLoading] = useState(true)
  const [activePromo, setActivePromo] = useState(0)
  const [heroQuery, setHeroQuery] = useState('')

  useEffect(() => {
    Promise.all([
      getFeaturedStores().catch(() => [] as Store[]),
      getCategories().catch(() => [] as Category[]),
      getBrands().catch(() => [] as Brand[]),
      getProducts({ limit: 8, promoted: true }).catch(() => ({
        items: [] as Product[],
        meta: { total: 0, page: 1, limit: 8, pages: 0 },
      })),
      getProducts({ limit: 12, sort: 'newest' }).catch(() => ({
        items: [] as Product[],
        meta: { total: 0, page: 1, limit: 12, pages: 0 },
      })),
      getStores().catch(() => [] as Store[]),
    ]).then(([s, c, b, fp, lp, allS]) => {
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
      setFeaturedProducts(fp.items.length > 0 ? fp.items : lp.items.slice(0, 8))
      setLatestProducts(lp.items)
      setTotalAds(lp.meta?.total ?? 0)
      setLoading(false)
    })
  }, [])

  function handlePromoScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x
    setActivePromo(Math.round(x / (PROMO_W + spacing.md)))
  }

  function submitHeroSearch() {
    const q = heroQuery.trim()
    if (q) {
      router.push({ pathname: '/(tabs)/products', params: { search: q } })
    } else {
      router.push('/(tabs)/products')
    }
  }

  const roundedAds = totalAds < 100 ? totalAds : Math.round(totalAds / 100) * 100
  const storesStat = allStores.length || 850

  return (
    <SafeAreaView
      style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]}
      edges={['top']}
    >
      {/* Persistent top bar — icon row only */}
      <View style={styles.topBar}>
        <Logo size="sm" light />
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          >
            <Ionicons name="globe-outline" size={20} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/dashboard/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/dashboard/messages')}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={[styles.center, { backgroundColor: colors.dk }]}>
          <ActivityIndicator color={colors.y} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Hero card — scrolls off with content */}
          <View style={styles.heroCard}>
            {user?.displayName && (
              <Text
                style={[
                  styles.greeting,
                  { textAlign: 'auto', writingDirection: isRtl ? 'rtl' : 'ltr' },
                ]}
              >
                {t.welcomeBack}, {user.displayName} 👋
              </Text>
            )}

            <Text
              style={[
                styles.heroTitle,
                { textAlign: 'auto', writingDirection: isRtl ? 'rtl' : 'ltr' },
              ]}
            >
              {t.heroTitle}
            </Text>
            <Text
              style={[
                styles.heroSub,
                { textAlign: 'auto', writingDirection: isRtl ? 'rtl' : 'ltr' },
              ]}
            >
              {t.heroSub}
            </Text>

            <View style={styles.hsearch}>
              <TextInput
                value={heroQuery}
                onChangeText={setHeroQuery}
                placeholder={t.heroSearchPlaceholder}
                placeholderTextColor={colors.g400}
                style={[styles.hsearchInput, { textAlign: isRtl ? 'right' : 'left' }]}
                returnKeyType="search"
                onSubmitEditing={submitHeroSearch}
              />
              <TouchableOpacity
                style={styles.hsearchBtn}
                activeOpacity={0.85}
                onPress={submitHeroSearch}
              >
                <Text style={styles.hsearchBtnText}>{t.heroSearchBtn}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.hstats}>
              <View style={styles.hstat}>
                <Text style={styles.hstatNum}>{roundedAds > 0 ? `${roundedAds}+` : '—'}</Text>
                <Text style={styles.hstatLabel}>{t.activeAds}</Text>
              </View>
              <View style={styles.hstatDivider} />
              <View style={styles.hstat}>
                <Text style={styles.hstatNum}>{storesStat}+</Text>
                <Text style={styles.hstatLabel}>{t.verifiedStoresLabel}</Text>
              </View>
              <View style={styles.hstatDivider} />
              <View style={styles.hstat}>
                <Text style={styles.hstatNum}>2K+</Text>
                <Text style={styles.hstatLabel}>{t.usersLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.content}>
          {/* Promo Carousel */}
          <View style={styles.promoSection}>
            <FlatList
              horizontal
              data={PROMO_BANNERS}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => <PromoCard item={item} />}
              contentContainerStyle={styles.promoList}
              showsHorizontalScrollIndicator={false}
              snapToInterval={PROMO_W + spacing.md}
              decelerationRate="fast"
              onScroll={handlePromoScroll}
              scrollEventThrottle={16}
            />
            <PromoDots count={PROMO_BANNERS.length} active={activePromo} />
          </View>

          {/* Upgrade Banner — clients only */}
          {user && !user.isStore && <UpgradeBanner />}

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
                keyExtractor={s => String(s.id)}
                renderItem={({ item }) => <StoreCard store={item} style={{ width: 150 }} />}
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
                  <ProductCard key={p.id} product={p} style={{ width: CARD_W }} />
                ))}
              </View>
            </Section>
          )}

          {/* Latest Products */}
          {latestProducts.length > 0 && (
            <Section title={t.latestProducts} onMore={() => router.push('/(tabs)/products')}>
              <View style={styles.productsGrid}>
                {latestProducts.map(p => (
                  <ProductCard key={p.id} product={p} style={{ width: CARD_W }} />
                ))}
              </View>
            </Section>
          )}

          {/* All Stores */}
          {allStores.length > 0 && (
            <Section title={t.allStores} onMore={() => router.push('/(tabs)/stores')}>
              <FlatList
                horizontal
                data={allStores}
                keyExtractor={s => String(s.id)}
                renderItem={({ item }) => <StoreCard store={item} style={{ width: 150 }} />}
                contentContainerStyle={styles.hList}
                showsHorizontalScrollIndicator={false}
              />
            </Section>
          )}

          {/* Brands */}
          {brands.length > 0 && (
            <Section title={t.brands}>
              <View style={styles.brandsGrid}>
                {brands.map(b => (
                  <BrandCard key={b.id} brand={b} locale={locale} width={BRAND_W} />
                ))}
              </View>
            </Section>
          )}

          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dk },
  scrollView: {
    flex: 1,
    backgroundColor: colors.dk,
  },
  content: {
    backgroundColor: colors.g100,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: spacing.xl,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.dk,
  },
  heroCard: {
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
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
  greeting: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  // ── Hero (mirrors website .hero / .h-badge / .hsearch / .hstats) ──
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.yl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  heroBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.yd,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 30,
    color: colors.white,
    lineHeight: 42,
    marginTop: spacing.lg,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSub: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 24,
    marginTop: 10,
  },
  hsearch: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  hsearchInput: {
    flex: 1,
    height: 46,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },
  hsearchBtn: {
    height: 46,
    backgroundColor: colors.y,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsearchBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  hstats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  hstat: {
    flex: 1,
    alignItems: 'center',
  },
  hstatNum: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.y,
  },
  hstatLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  hstatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {},

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
