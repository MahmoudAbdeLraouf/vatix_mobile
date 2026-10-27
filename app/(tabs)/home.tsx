import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg'
import * as Sentry from '@sentry/react-native'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import {
  Brand,
  getFeaturedStores,
  getCategories,
  getBrands,
  getProducts,
  getRateAppEnabled,
  getStores,
  imgUrl,
  localeName,
  Product,
  Store,
} from '@/lib/api'
import { markActionSeen, type StoredUser } from '@/lib/auth'
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
import { BroEntryCard, useBroEnabled } from '@/components/bro/BroEntryCard'
import { ErrorState } from '@/components/ui/ErrorState'
import { Logo } from '@/components/ui/Logo'
import { colors, darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { geekoXml, requestXml } from '@/assets/promo/art'
import { slide2Xml } from '@/assets/onboarding/slide-2'
import { slide3Xml } from '@/assets/onboarding/slide-3'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = Math.floor((SCREEN_W - spacing.lg * 2 - spacing.md) / 2)
const BRAND_W = Math.floor((SCREEN_W - spacing.lg * 2 - spacing.md * 2) / 3)
const PROMO_W = SCREEN_W - spacing.lg * 2

const APP_VERSION = Constants.expoConfig?.version ?? '—'
const APP_BUILD = Application.nativeBuildVersion ?? '—'

type IoniconName = SharedIoniconName

// ─── Promo Carousel ───────────────────────────────────────────────────────────

const PROMO_H = 150
const PROMO_INTERVAL = PROMO_W + spacing.md
const PROMO_AUTO_MS = 5000

interface PromoTheme {
  from: string
  to: string
  title: string
  sub: string
  btnBg: string
  btnText: string
  artMap: Record<string, string>
}

const PROMO_NAVY: PromoTheme = {
  from: '#1A437E',
  to: colors.dk,
  title: colors.white,
  sub: 'rgba(255,255,255,0.72)',
  btnBg: colors.y,
  btnText: colors.dk,
  artMap: {
    '#eaecf0': 'rgba(255,255,255,0.12)',
    '#c9d1de': 'rgba(255,255,255,0.35)',
    '#062b5b': colors.y,
  },
}

const PROMO_GOLD: PromoTheme = {
  from: '#FFD24D',
  to: colors.y,
  title: colors.dk,
  sub: 'rgba(6,43,91,0.72)',
  btnBg: colors.dk,
  btnText: colors.white,
  artMap: {
    '#eaecf0': 'rgba(255,255,255,0.35)',
    '#c9d1de': 'rgba(255,255,255,0.6)',
  },
}

// Onboarding art is drawn in navy/grey; remap so it reads on the card colour.
function recolorArt(xml: string, map: Record<string, string>) {
  return Object.entries(map).reduce(
    (out, [from, to]) => out.split(from).join(to).split(from.toUpperCase()).join(to),
    xml,
  )
}

type PromoId = 'geeko' | 'ask' | 'add' | 'open'

interface PromoSlide {
  id: PromoId
  theme: PromoTheme
  art: string
  titleKey: 'promoGeekoTitle' | 'promoAskTitle' | 'promoAddTitle' | 'promoOpenTitle'
  subKey: 'promoGeekoSubtitle' | 'promoAskSubtitle' | 'promoAddSubtitle' | 'promoOpenSubtitle'
  btnKey: 'promoGeekoCta' | 'promoAskCta' | 'promoAddCta' | 'promoOpenCta'
}

// Same slides for every user type; only the tap destination differs.
const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'geeko',
    theme: PROMO_NAVY,
    art: recolorArt(geekoXml, PROMO_NAVY.artMap),
    titleKey: 'promoGeekoTitle',
    subKey: 'promoGeekoSubtitle',
    btnKey: 'promoGeekoCta',
  },
  {
    id: 'ask',
    theme: PROMO_GOLD,
    art: recolorArt(requestXml(colors.dk, colors.white, colors.y), PROMO_GOLD.artMap),
    titleKey: 'promoAskTitle',
    subKey: 'promoAskSubtitle',
    btnKey: 'promoAskCta',
  },
  {
    id: 'add',
    theme: PROMO_NAVY,
    art: recolorArt(slide2Xml, PROMO_NAVY.artMap),
    titleKey: 'promoAddTitle',
    subKey: 'promoAddSubtitle',
    btnKey: 'promoAddCta',
  },
  {
    id: 'open',
    theme: PROMO_GOLD,
    art: recolorArt(slide3Xml, PROMO_GOLD.artMap),
    titleKey: 'promoOpenTitle',
    subKey: 'promoOpenSubtitle',
    btnKey: 'promoOpenCta',
  },
]

const BRO_SLIDES: PromoId[] = ['geeko', 'ask']

function openPromo(id: PromoId, user: StoredUser | null) {
  switch (id) {
    case 'geeko':
    case 'ask':
      // /bro/new sends guests to login itself and keeps their draft.
      router.push({
        pathname: '/bro/new',
        params: { source: 'home' },
      } as never)
      return
    case 'add':
      if (user) router.push('/products/new')
      else
        router.push({
          pathname: '/(auth)/login',
          params: { redirect: '/products/new' },
        })
      return
    case 'open':
      if (!user) router.push('/(auth)/login')
      else if (user.isStore) router.push(`/store/${user.id}`)
      else router.push('/dashboard/subscription')
      return
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PromoCard({ item, onPress }: { item: PromoSlide; onPress: () => void }) {
  const { t, isRtl } = useLocale()
  const { isDark } = useTheme()
  const { theme } = item
  const gradientId = `promo-${item.id}`
  // Navy slides sink into the dark page, so they get a deeper end stop and an outline.
  const darkNavy = isDark && theme === PROMO_NAVY
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        promoStyles.card,
        { width: PROMO_W, direction: isRtl ? 'rtl' : 'ltr', backgroundColor: theme.from },
        darkNavy && promoStyles.darkOutline,
      ]}
    >
      {/* Inner layer clips the rounded corners; the outer one keeps the shadow. */}
      <View style={promoStyles.inner}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.from} />
              <Stop offset="1" stopColor={darkNavy ? '#0F2A55' : theme.to} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>

        {/* Padding lives on this row, not the clip layer, so the gradient spans the full card. */}
        <View style={promoStyles.row}>
          <View style={promoStyles.textCol}>
            <Text style={[promoStyles.title, { color: theme.title }]} numberOfLines={1}>
              {t[item.titleKey]}
            </Text>
            <Text style={[promoStyles.sub, { color: theme.sub }]} numberOfLines={1}>
              {t[item.subKey]}
            </Text>
            <View style={[promoStyles.btn, { backgroundColor: theme.btnBg }]}>
              <Text style={[promoStyles.btnText, { color: theme.btnText }]}>{t[item.btnKey]}</Text>
              <Ionicons
                name={isRtl ? 'arrow-back-outline' : 'arrow-forward-outline'}
                size={13}
                color={theme.btnText}
              />
            </View>
          </View>

          <SvgXml xml={item.art} width={128} height={128} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const promoStyles = StyleSheet.create({
  card: {
    height: PROMO_H,
    borderRadius: 20,
    elevation: 4,
    shadowColor: colors.dk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  darkOutline: {
    borderWidth: 1,
    borderColor: darkColors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  inner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingStart: 20,
    paddingEnd: 4,
  },
  textCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 21,
    lineHeight: 28,
  },
  sub: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  btnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
})

// ScrollView + map instead of FlatList to avoid Android RTL ANR: horizontal
// FlatList's batched item mount fires repeated onContentSizeChange, and each
// one recurses through ReactHorizontalScrollView.adjustPositionForContentChangeRTL
// → scrollTo → new layout → another content-size change. See Sentry
// VATIX-MOBILE-33. The scroller itself is pinned LTR (cards restore their own
// direction) so offsets map to slide indexes the same way on both platforms.
function PromoCarousel() {
  const { user } = useAuth()
  const broEnabled = useBroEnabled()
  const slides = useMemo(
    () => (broEnabled ? PROMO_SLIDES : PROMO_SLIDES.filter(s => !BRO_SLIDES.includes(s.id))),
    [broEnabled],
  )

  const scrollRef = useRef<ScrollView>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const touchingRef = useRef(false)
  const lastMoveRef = useRef(Date.now())

  const setIndex = useCallback((i: number) => {
    activeRef.current = i
    setActive(i)
  }, [])

  // Slide list changes once Bro status resolves — start over from the first.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: false })
    setIndex(0)
  }, [slides.length, setIndex])

  // Auto-advance while the home tab is focused: moves on once a slide has been
  // showing for PROMO_AUTO_MS, never while a finger is on the carousel. Polls
  // each second so a swipe restarts the countdown instead of skipping a tick.
  useFocusEffect(
    useCallback(() => {
      if (slides.length < 2) return
      lastMoveRef.current = Date.now()
      const timer = setInterval(() => {
        if (touchingRef.current) return
        if (Date.now() - lastMoveRef.current < PROMO_AUTO_MS) return
        const next = (activeRef.current + 1) % slides.length
        scrollRef.current?.scrollTo({
          x: next * PROMO_INTERVAL,
          animated: true,
        })
        setIndex(next)
        lastMoveRef.current = Date.now()
      }, 1000)
      return () => clearInterval(timer)
    }, [slides.length, setIndex]),
  )

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / PROMO_INTERVAL)
      const clamped = Math.max(0, Math.min(slides.length - 1, i))
      if (clamped !== activeRef.current) setIndex(clamped)
    },
    [slides.length, setIndex],
  )

  const holdStart = useCallback(() => {
    touchingRef.current = true
  }, [])
  const holdEnd = useCallback(() => {
    touchingRef.current = false
    lastMoveRef.current = Date.now()
  }, [])

  const styles = useStyles()
  return (
    <View style={styles.promoSection}>
      <ScrollView
        ref={scrollRef}
        horizontal
        style={{ direction: 'ltr' }}
        contentContainerStyle={styles.promoList}
        showsHorizontalScrollIndicator={false}
        snapToInterval={PROMO_INTERVAL}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={holdStart}
        onTouchEnd={holdEnd}
        onTouchCancel={holdEnd}
        onScrollBeginDrag={holdStart}
        onScrollEndDrag={holdEnd}
      >
        {slides.map(item => (
          <PromoCard key={item.id} item={item} onPress={() => openPromo(item.id, user)} />
        ))}
      </ScrollView>
      <PromoDots count={slides.length} active={active} />
    </View>
  )
}

function PromoDots({ count, active }: { count: number; active: number }) {
  const dotStyles = themedDotStyles[useTheme().mode]
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[dotStyles.dot, i === active && dotStyles.dotActive]} />
      ))}
    </View>
  )
}

const makeDotStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 5,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.dot,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.y,
  },
})

const themedDotStyles = { light: makeDotStyles(lightColors), dark: makeDotStyles(darkColors) }

function BrandCard({ brand, locale, width }: { brand: Brand; locale: string; width: number }) {
  const name = localeName(brand.translations, locale as 'ar' | 'en')
  const logoUrl = imgUrl(brand.logo)
  const icon = getBrandIcon(name)
  const brandCardStyles = themedBrandStyles[useTheme().mode]
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

// The logo tile stays light in dark mode so dark brand logos stay readable.
const makeBrandStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    ...(dark ? null : shadow.sm),
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: dark ? colors.g200 : colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 48, height: 48 },
  name: { fontFamily: fonts.semiBold, fontSize: 11, color: dark ? colors.catText : colors.g700, textAlign: 'center' },
})

const themedBrandStyles = { light: makeBrandStyles(lightColors, false), dark: makeBrandStyles(darkColors, true) }

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  const { t, isRtl } = useLocale()
  const { mode, colors } = useTheme()
  const styles = themedStyles[mode]
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
            color={colors.seeAllText}
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
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <SectionHeader title={title} onMore={onMore} />
      {children}
    </View>
  )
}

function ProductRowSeparator() {
  const styles = useStyles()
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
  const { mode, colors } = useTheme()
  const styles = themedStyles[mode]

  const [stores, setStores] = useState<Store[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [latestProducts, setLatestProducts] = useState<Product[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [search, setSearch] = useState('')
  const [showRateAppDialog, setShowRateAppDialog] = useState(false)

  const loadHome = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Only categories + latest products are load-bearing. Everything else
      // degrades gracefully — a single flaky endpoint (featured stores, brands,
      // promoted products, all stores) must not nuke the whole home screen.
      // Each secondary rejection is logged to Sentry so we can see what's
      // actually failing on user devices.
      const [cRes, lpRes, sRes, bRes, fpRes, allSRes] = await Promise.allSettled([
        getCategories(),
        getProducts({ limit: 12, sort: 'newest_pure' }),
        getFeaturedStores(),
        IS_IOS ? Promise.resolve([] as Brand[]) : getBrands(),
        getProducts({ limit: 8, promoted: true }),
        getStores(),
      ])

      if (cRes.status === 'rejected') throw cRes.reason
      if (lpRes.status === 'rejected') throw lpRes.reason
      const c = cRes.value
      const lp = lpRes.value

      const pick = <T,>(r: PromiseSettledResult<T>, label: string, fallback: T): T => {
        if (r.status === 'fulfilled') return r.value
        Sentry.captureException(r.reason, {
          tags: { source: 'home.loadHome', endpoint: label, degraded: 'true' },
        })
        return fallback
      }
      const s = pick(sRes, 'featuredStores', [] as Store[])
      const b = pick(bRes, 'brands', [] as Brand[])
      const fp = pick(fpRes, 'featuredProducts', { items: [] as Product[] } as Awaited<ReturnType<typeof getProducts>>)
      const allS = pick(allSRes, 'allStores', [] as Store[])

      // Categories is a curated list that is never empty in production. If BOTH
      // categories AND latest products came back 200-OK-but-empty, something is
      // wrong upstream (bad CDN cache, stale edge) and a blank home would look
      // broken — surface it as an error the user can retry.
      if (c.length === 0 && lp.items.length === 0) {
        Sentry.captureMessage('[home] primary fetches returned empty', {
          level: 'warning',
          extra: {
            featuredStores: s.length,
            categories: c.length,
            brands: b.length,
            featuredProducts: fp.items.length,
            latestProducts: lp.items.length,
            allStores: allS.length,
          },
        })
        setError(new Error('EMPTY_HOME'))
        return
      }
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
    } catch (e) {
      Sentry.captureException(e, { tags: { source: 'home.loadHome' } })
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [t, locale])

  useEffect(() => {
    loadHome()
  }, [loadHome])

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
    [styles],
  )
  const productKey = useCallback((p: Product) => String(p.id), [])

  const listHeader = useMemo(
    () => (
      <>
        <PromoCarousel />

        {/* Category Icons */}
        {categories.length > 1 && (
          <Section title={t.categories} onMore={() => router.push('/(tabs)/products')}>
            <ScrollView
              horizontal
              contentContainerStyle={styles.categoriesList}
              showsHorizontalScrollIndicator={false}
            >
              {categories.map(item => (
                <TouchableOpacity
                  key={String(item.id)}
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
                    <Ionicons name={item.icon} size={28} color={colors.catIcon} />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Vatix Bro card (renders nothing unless Bro is enabled). Sits after categories as the
            "can't find it?" fallback, and away from the carousel so it isn't read as a navy promo slide. */}
        <BroEntryCard variant="home" />

        {/* Featured Stores */}
        {stores.length > 0 && (
          <Section title={t.featuredStores} onMore={() => router.push('/(tabs)/stores')}>
            <ScrollView
              horizontal
              contentContainerStyle={styles.hList}
              showsHorizontalScrollIndicator={false}
            >
              {stores.map(item => (
                <StoreCard key={item.id} store={item} style={styles.storeCardWide} />
              ))}
            </ScrollView>
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
      categories,
      stores,
      featuredProducts,
      latestProducts.length,
      styles,
      colors,
    ],
  )

  const listFooter = useMemo(
    () => (
      <>
        {/* All Stores */}
        {allStores.length > 0 && (
          <Section title={t.allStores} onMore={() => router.push('/(tabs)/stores')}>
            <ScrollView
              horizontal
              contentContainerStyle={styles.hList}
              showsHorizontalScrollIndicator={false}
            >
              {allStores.map(item => (
                <StoreCard key={item.id} store={item} style={styles.storeCardWide} />
              ))}
            </ScrollView>
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

        <Text style={styles.versionText}>
          v{APP_VERSION} ({APP_BUILD})
        </Text>
      </>
    ),
    [t, allStores, brands, locale, styles],
  )

  return (
    <SafeAreaView style={[styles.safe, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
      <View style={styles.container}>
        {loading ? (
          <View style={[styles.center, { backgroundColor: colors.bg }]}>
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
              <View style={styles.heroSearchRow}>
                <View style={styles.heroSearchBar}>
                  <Ionicons name="search-outline" size={20} color={colors.muted} />
                  <TextInput
                    style={[styles.searchInput, { textAlign: 'auto' }]}
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t.search}
                    placeholderTextColor={colors.subtle}
                    returnKeyType="search"
                    onSubmitEditing={submitSearch}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={18} color={colors.subtle} />
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
            </View>
            <View style={styles.content}>
              {error ? (
                <ErrorState
                  kind={error.message === 'EMPTY_HOME' ? 'generic' : 'network'}
                  onRetry={loadHome}
                  style={styles.errorState}
                />
              ) : (
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
              )}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.hero },
  container: { flex: 1 },
  content: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  hero: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
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
    backgroundColor: colors.searchBg,
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
    color: colors.text,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // The list pads vertically so card shadows are not clipped by the scroller
  // (a clipped shadow shows as a grey band); marginTop absorbs that padding.
  promoSection: {
    marginTop: spacing.lg - spacing.md,
  },
  promoList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    backgroundColor: colors.catBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.catText,
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
    color: colors.text,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.seeAllBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  seeAll: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.seeAllText,
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
    color: colors.muted,
  },
  brandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
  },
  versionText: {
    textAlign: 'center',
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingVertical: spacing.lg,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }

function useStyles() {
  return themedStyles[useTheme().mode]
}
