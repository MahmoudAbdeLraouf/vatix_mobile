import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import {
  ExpiredResource,
  getProduct,
  getProducts,
  getSpotlightStores,
  imgUrl,
  isExpiredResource,
  localeName,
  Product,
  ProductImage,
  Store,
} from '@/lib/api'
import { ProductCard } from '@/components/ProductCard'
import { logShare } from '@/lib/auth'
import { track, trackProductView, trackProductWhatsappClick } from '@/lib/analytics'
import { bumpEngagement } from '@/lib/rate-app-engagement'
import { FavoriteButton } from '@/components/FavoriteButton'
import { MessagesBell } from '@/components/MessagesBell'
import { BroEntryCard } from '@/components/bro/BroEntryCard'
import { RevealPhone } from '@/components/RevealPhone'
import { StartChatButton } from '@/components/StartChatButton'
import { StarRating } from '@/components/StarRating'
import { RatingSection } from '@/components/RatingSection'
import { VerifiedBadge, VerifiedSeal } from '@/components/VerifiedBadge'
import { SalesRecordPill } from '@/components/SalesRecordPill'
import { SalesRecordSheet } from '@/components/SalesRecordSheet'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const { width: SCREEN_W } = Dimensions.get('window')
const HERO_H = 420
// Hero targets the device pixel width (capped) so we don't ship a 3000-px
// original when the screen is 390 pt wide. The list card already caches a
// 400-px thumbnail — we pass it as `placeholder` for instant paint.
const HERO_TARGET_W = Math.min(1080, Math.round(SCREEN_W * 2))
const THUMB_TARGET_W = 160
// Pinned header (bar + section tabs) fades in as the hero scrolls away.
const PIN_BAR_H = 56
const PIN_TABS_H = 46
const PIN_H = PIN_BAR_H + PIN_TABS_H
type SectionKey = 'seller' | 'description' | 'details' | 'reviews' | 'similar'

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://vatix.store'
const WA_GREEN = '#25D366'

function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\s+/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('0')) digits = '20' + digits.slice(1)
  return digits.replace(/\D/g, '') || null
}

function buildWaLink(
  whatsapp: string | null | undefined,
  title: string,
  price: number,
  productIdent: number | string,
  ar: boolean,
): string | null {
  const n = normalizeWhatsapp(whatsapp)
  if (!n) return null
  const url = `${SITE_URL}/products/${productIdent}`
  const msg = ar
    ? `مرحباً، أنا مهتم بالمنتج:\n${title}\nالسعر: ${price} جنيه\n${url}`
    : `Hi, I'm interested in:\n${title}\nPrice: ${price} EGP\n${url}`
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`
}

function formatDate(iso: string, locale: 'ar' | 'en'): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, locale, isRtl, setLocale } = useLocale()
  const { colors } = useTheme()
  const { styles } = useStyles()
  const { user } = useAuth()
  const { requireLogin } = useLoginGate()
  const insets = useSafeAreaInsets()
  const [product, setProduct] = useState<Product | ExpiredResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const [salesSheetOpen, setSalesSheetOpen] = useState(false)
  const [similarItems, setSimilarItems] = useState<Product[]>([])
  const [spotlightStores, setSpotlightStores] = useState<Store[]>([])
  const galleryRef = useRef<FlatList<ProductImage>>(null)
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]
      if (first?.index == null) return
      setImgIndex(first.index)
    },
  ).current

  // Direction-aware text styling — applied to every Text node so Arabic text
  // reads right-to-left and English left-to-right regardless of the native
  // I18nManager flag (which lags behind hot locale switches until reload).
  const dir = useMemo(
    () => ({
      writingDirection: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
      textAlign: 'auto' as const,
    }),
    [isRtl],
  )
  const dirEnd = useMemo(
    () => ({
      writingDirection: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
      textAlign: (isRtl ? 'left' : 'right') as 'left' | 'right',
    }),
    [isRtl],
  )
  const backIcon = isRtl ? 'chevron-forward-outline' : 'chevron-back-outline'
  const forwardIcon = isRtl ? 'chevron-back-outline' : 'chevron-forward-outline'

  // Pinned header state. Section offsets are measured relative to the content
  // card, so cardY is added back when comparing against the scroll offset.
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useRef(new Animated.Value(0)).current
  const cardY = useRef(0)
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({})
  const tabKeys = useRef<SectionKey[]>([])
  const tabLockUntil = useRef(0)
  const pinnedRef = useRef(false)
  const activeTabRef = useRef<SectionKey | null>(null)
  const [pinned, setPinned] = useState(false)
  const [activeTab, setActiveTab] = useState<SectionKey | null>(null)
  const selectTab = (key: SectionKey | null) => {
    if (key === activeTabRef.current) return
    activeTabRef.current = key
    setActiveTab(key)
  }
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
          const y = contentOffset.y
          const nextPinned = y > HERO_H - PIN_H + 14
          if (nextPinned !== pinnedRef.current) {
            pinnedRef.current = nextPinned
            setPinned(nextPinned)
          }
          if (Date.now() < tabLockUntil.current) return
          const keys = tabKeys.current
          let next: SectionKey | null = keys[0] ?? null
          if (keys.length && y + layoutMeasurement.height >= contentSize.height - 4) {
            next = keys[keys.length - 1]
          } else {
            for (const key of keys) {
              const sy = sectionY.current[key]
              if (sy != null && cardY.current + sy <= y + PIN_H + 20) next = key
            }
          }
          if (next !== activeTabRef.current) {
            activeTabRef.current = next
            setActiveTab(next)
          }
        },
      }),
    [scrollY],
  )

  useEffect(() => {
    if (!id) return
    getProduct(Number(id))
      .then(setProduct)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const pid = Number(id)
    if (Number.isFinite(pid) && pid > 0) {
      trackProductView(pid)
      void bumpEngagement('product_view')
    }
  }, [id])

  // Similar-products query mirrors website: soft-rank store listings first so
  // spotlight stores' items surface before individual sellers'. Fetch 7 to
  // guarantee 6 after excluding the current product.
  useEffect(() => {
    if (!product || isExpiredResource(product) || !product.category) return
    const categoryId = product.category.id
    const currentId = product.id
    void Promise.all([
      getProducts({ categoryId, limit: 7, storeFirst: true })
        .then((r) => r.items.filter((p) => p.id !== currentId).slice(0, 6))
        .catch(() => [] as Product[]),
      getSpotlightStores(10).catch(() => [] as Store[]),
    ]).then(([sim, spot]) => {
      setSimilarItems(sim)
      setSpotlightStores(spot)
    })
  }, [product])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.y} size="large" />
      </View>
    )
  }

  if (isExpiredResource(product)) {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={48} color={colors.muted} />
        <Text style={[styles.expiredTitle, dir]}>{t.expiredListing}</Text>
        <Text style={[styles.expiredHint, dir]}>{t.expiredListingHint}</Text>
        <Pressable
          style={styles.expiredCta}
          onPress={() => router.replace('/(tabs)/products')}
        >
          <Text style={styles.expiredCtaText}>{t.backToListings}</Text>
        </Pressable>
      </View>
    )
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={[styles.missing, dir]}>{t.noResults}</Text>
      </View>
    )
  }

  const images = product.images
  const categoryName = product.category ? localeName(product.category.translations, locale) : ''
  const brandName = product.brand ? localeName(product.brand.translations, locale) : ''
  const locationName = product.location ? localeName(product.location.translations, locale) : ''
  const isNew = product.condition === 'new'
  const conditionLabel =
    {
      new: t.conditionNew,
      used_excellent: t.conditionUsedExcellent,
      used_good: t.conditionUsedGood,
      used_acceptable: t.conditionUsedAcceptable,
    }[product.condition ?? ''] ?? t.conditionUsed

  const owner = product.owner
  const isStore = owner?.type === 'store'
  const storeName =
    owner?.storeProfile?.name ??
    (owner?.clientProfile
      ? `${owner.clientProfile.firstName ?? ''} ${owner.clientProfile.lastName ?? ''}`.trim()
      : '')
  const storeLogo = imgUrl(owner?.storeProfile?.logo, { w: THUMB_TARGET_W })
  const ownerVerification = owner?.storeProfile?.verification ?? owner?.verification
  const ownerBadge =
    isStore
      ? { label: locale === 'ar' ? 'متجر 🏪' : 'Store 🏪', bg: colors.placeholder, fg: colors.text }
      : { label: locale === 'ar' ? 'فرد 👤' : 'Individual 👤', bg: colors.placeholder, fg: colors.text }

  // Expired store owners keep their listings visible, but phone/WhatsApp CTAs are
  // hidden so buyers are routed exclusively through in-app chat (which forces
  // login → paywall). Chat still fires a notification via the existing pipeline.
  const isOwnerExpired = isStore && !!owner?.subscriptionExpired
  const ownerContact = isOwnerExpired ? null : (owner?.contactPhone ?? null)
  const waSource = product.showPhone && !isOwnerExpired ? ownerContact : null
  const waLink = buildWaLink(
    waSource,
    product.title,
    product.price,
    product.slug ?? product.id,
    locale === 'ar',
  )
  const hasPhoneReveal = product.showPhone && !isOwnerExpired && !!ownerContact
  const hasActions = !!owner?.id || !!waLink || hasPhoneReveal

  // Vatix Bro entry points: never shown to the listing's own owner.
  const isOwnListing = !!owner?.id && user?.id === owner.id
  const isUnavailable = !product.isActive || !!product.soldAt || isOwnerExpired
  const broContext = {
    productId: product.id,
    categoryId: product.category?.id ?? null,
    brandId: product.brand?.id ?? null,
    locationId: product.location?.id ?? null,
    model: product.title,
    price: product.price,
  }
  const bottomBarH =
    Math.max(insets.bottom, spacing.md) + 56 + spacing.md + spacing.lg + spacing.md

  const avg = product.averageRating ?? 0
  const ratingsCount = product.ratingsCount ?? 0

  const onShare = () => {
    const url = `${SITE_URL}/products/${product.slug ?? product.id}`
    const msg = locale === 'ar'
      ? `${product.title}\nالسعر: ${product.price} جنيه\n${url}`
      : `${product.title}\nPrice: ${product.price} EGP\n${url}`
    logShare('product', product.id, 'native')
    Share.share({ message: msg, url, title: product.title }).catch(() => {})
  }

  const ar = locale === 'ar'
  const tabs: { key: SectionKey; label: string }[] = [
    ...(owner?.id ? [{ key: 'seller' as const, label: ar ? 'البائع' : 'Seller' }] : []),
    ...(product.description ? [{ key: 'description' as const, label: t.description }] : []),
    { key: 'details', label: ar ? 'التفاصيل' : 'Details' },
    { key: 'reviews', label: t.reviews },
    ...(similarItems.length > 0 && product.category
      ? [{ key: 'similar' as const, label: ar ? 'مشابهة' : 'Similar' }]
      : []),
  ]
  tabKeys.current = tabs.map((tab) => tab.key)
  const currentTab = activeTab ?? tabs[0]?.key
  const measure = (key: SectionKey) => (e: { nativeEvent: { layout: { y: number } } }) => {
    sectionY.current[key] = e.nativeEvent.layout.y
  }
  const scrollToSection = (key: SectionKey) => {
    const sy = sectionY.current[key]
    if (sy == null) return
    tabLockUntil.current = Date.now() + 600
    selectTab(key)
    scrollRef.current?.scrollTo({ y: Math.max(0, cardY.current + sy - PIN_H - 8), animated: true })
  }
  const pinRange = [HERO_H - PIN_H - 18, HERO_H - PIN_BAR_H]
  const pinOpacity = scrollY.interpolate({ inputRange: pinRange, outputRange: [0, 1], extrapolate: 'clamp' })
  const pinShift = scrollY.interpolate({ inputRange: pinRange, outputRange: [-8, 0], extrapolate: 'clamp' })
  const pinThumb = imgUrl(images[0]?.url, { w: THUMB_TARGET_W })

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          bounces
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={hasActions ? { paddingBottom: bottomBarH } : undefined}
        >
          {/* ── Dark image zone ── */}
          <View style={styles.imageZone}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />

            {images.length > 0 ? (
              <FlatList
                ref={galleryRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const u = imgUrl(item.url, { w: HERO_TARGET_W })
                  const placeholder = imgUrl(item.url, { w: 400 })
                  return u ? (
                    <Image
                      source={{ uri: u }}
                      placeholder={placeholder ? { uri: placeholder } : undefined}
                      placeholderContentFit="contain"
                      style={styles.heroImage}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      transition={150}
                      recyclingKey={String(item.id)}
                    />
                  ) : (
                    <View style={styles.heroPlaceholder} />
                  )
                }}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                initialNumToRender={Math.max(images.length, 1)}
                maxToRenderPerBatch={Math.max(images.length, 1)}
                windowSize={Math.max(images.length * 2, 3)}
                removeClippedSubviews={false}
              />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}

            {/* Page dots — force row-reverse in RTL so dot[0] visually aligns
                with image[0] (which native RTL FlatList renders at the right). */}
            {images.length > 1 && (
              <View
                pointerEvents="none"
                style={[styles.dotsRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
              >
                {images.map((img, i) => (
                  <View
                    key={img.id}
                    style={[styles.dot, i === imgIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}

            {/* Image counter pill */}
            {images.length > 1 && (
              <View style={styles.counterPill}>
                <Ionicons name="images-outline" size={11} color={colors.white} />
                <Text style={styles.counterText}>
                  {imgIndex + 1} / {images.length}
                </Text>
              </View>
            )}

            {/* Floating header — back button always on the visual start side */}
            <View style={styles.floatingHeader}>
              <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name={backIcon} size={22} color={colors.white} />
              </Pressable>

              <View style={{ flex: 1 }} />

              <View style={styles.iconBtn}>
                <FavoriteButton
                  productId={product.id}
                  size={20}
                  color={colors.white}
                  activeColor={colors.error}
                />
              </View>
              <Pressable style={styles.iconBtn} onPress={onShare} hitSlop={8}>
                <Ionicons name="share-social-outline" size={20} color={colors.white} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                hitSlop={8}
              >
                <Ionicons name="globe-outline" size={20} color={colors.white} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => {
                  if (!requireLogin()) return
                  router.push('/dashboard/notifications')
                }}
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.white} />
              </Pressable>
              <MessagesBell color={colors.white} style={styles.iconBtn} />
              {owner?.id && user?.id === owner.id && (
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => router.push(`/products/edit/${product.id}`)}
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={20} color={colors.white} />
                </Pressable>
              )}
            </View>
          </View>

          {/* ── White content card ── */}
          <View style={styles.card} onLayout={(e) => { cardY.current = e.nativeEvent.layout.y }}>
            <View style={styles.handle} />

            {!isOwnListing && isUnavailable && <BroEntryCard variant="sold" context={broContext} />}

            {/* Condition + location row */}
            <View style={styles.badgeRow}>
              <View
                style={[styles.conditionBadge, isNew ? styles.conditionNew : styles.conditionUsed]}
              >
                {isNew && <View style={styles.conditionDot} />}
                <Text
                  style={[
                    styles.conditionText,
                    isNew ? styles.conditionNewText : styles.conditionUsedText,
                    dir,
                  ]}
                >
                  {conditionLabel}
                </Text>
              </View>
              <View style={styles.locationChip}>
                <Ionicons name="location-outline" size={12} color={colors.muted} />
                <Text style={[styles.locationText, dir]}>{locationName}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={[styles.title, dir]}>{product.title}</Text>

            {/* Rating row */}
            {ratingsCount > 0 && (
              <View style={styles.ratingRow}>
                <StarRating value={avg} size={16} />
                <Text style={[styles.ratingAvg, dir]}>{avg.toFixed(1)}</Text>
                <Text style={[styles.ratingCount, dir]}>
                  {locale === 'ar'
                    ? `(${ratingsCount} تقييم${ratingsCount === 1 ? '' : 'ات'})`
                    : `(${ratingsCount} review${ratingsCount === 1 ? '' : 's'})`}
                </Text>
              </View>
            )}

            {/* Price block */}
            <View style={styles.priceBlock}>
              <View style={styles.priceBlockGlow} />
              <View style={styles.priceMain}>
                <Text style={[styles.priceLabel, dir]}>{t.price}</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, dir]}>{Number(product.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}</Text>
                  <Text style={[styles.currency, dir]}>{t.egp}</Text>
                </View>
              </View>
              <View style={styles.priceAccent}>
                <Ionicons name="pricetag" size={22} color={colors.y} />
              </View>
            </View>

            {/* Store / seller card — only stores get the tappable "visit" CTA;
                individual client sellers render as a plain identity block since
                they have no storefront page to route to. */}
            {isStore && !!owner?.id && !!owner.salesRecord?.total && (
              <SalesRecordSheet
                visible={salesSheetOpen}
                storeId={owner.id}
                onClose={() => setSalesSheetOpen(false)}
              />
            )}
            {!!owner?.id && (
              <View onLayout={measure('seller')}>
              {isStore ? (
                <Pressable
                  onPress={() => router.push(`/store/${owner.id}`)}
                  style={({ pressed }) => [styles.sellerCard, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.sellerLogo}>
                    {storeLogo ? (
                      <Image
                        source={{ uri: storeLogo }}
                        style={styles.sellerLogoImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                      />
                    ) : (
                      <Text style={styles.sellerLogoFallback}>🏪</Text>
                    )}
                  </View>
                  <View style={styles.sellerMain}>
                    <View style={styles.sellerHeader}>
                      <Text style={[styles.sellerName, dir]} numberOfLines={1}>
                        {storeName || (locale === 'ar' ? 'بائع' : 'Seller')}
                      </Text>
                      <View style={[styles.sellerBadge, { backgroundColor: ownerBadge.bg }]}>
                        <Text style={[styles.sellerBadgeText, { color: ownerBadge.fg }, dir]}>
                          {ownerBadge.label}
                        </Text>
                      </View>
                    </View>
                    {!!ownerVerification?.verified && (
                      <View style={styles.sellerVerified}>
                        <VerifiedBadge verification={ownerVerification} variant="full" />
                      </View>
                    )}
                    {!!owner.salesRecord?.total && (
                      <View style={styles.sellerSales}>
                        <SalesRecordPill
                          variant="link"
                          total={owner.salesRecord.total}
                          onOpen={() => setSalesSheetOpen(true)}
                        />
                      </View>
                    )}
                    <View style={styles.sellerCtaRow}>
                      <Text style={[styles.sellerCta, dir]}>{t.visit}</Text>
                      <Ionicons name={forwardIcon} size={13} color={colors.heading} />
                    </View>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.sellerCard}>
                  <View style={styles.sellerLogo}>
                    <Text style={styles.sellerLogoFallback}>👤</Text>
                  </View>
                  <View style={styles.sellerMain}>
                    <View style={styles.sellerHeader}>
                      <Text style={[styles.sellerName, dir]} numberOfLines={1}>
                        {storeName || (locale === 'ar' ? 'بائع' : 'Seller')}
                      </Text>
                      <View style={[styles.sellerBadge, { backgroundColor: ownerBadge.bg }]}>
                        <Text style={[styles.sellerBadgeText, { color: ownerBadge.fg }, dir]}>
                          {ownerBadge.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
              </View>
            )}

            {!isOwnListing && !isUnavailable && <BroEntryCard variant="product" context={broContext} />}

            {/* Safety tips — surfaced before contact CTAs so buyers see the
                inspect-before-pay guidance before reaching out to any seller. */}
            <View style={styles.safetyCard}>
              <View style={styles.safetyHeader}>
                <View style={styles.safetyIconBadge}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.heading} />
                </View>
                <Text style={[styles.safetyTitle, dir]}>{t.safetyTipsTitle}</Text>
              </View>
              <Text style={[styles.safetyIntro, dir]}>{t.safetyTipsIntro}</Text>
              <View style={styles.safetyList}>
                <SafetyTip icon="phone-portrait-outline" text={t.safetyInspectDevice} dir={dir} />
                <SafetyTip icon="people-outline" text={t.safetyMeetPublic} dir={dir} />
                <SafetyTip icon="checkmark-done-outline" text={t.safetyVerifyBeforePay} dir={dir} />
                <SafetyTip icon="alert-circle-outline" text={t.safetyReportSuspicious} dir={dir} />
              </View>
            </View>

            {/* Brand + Category chips */}
            <View style={styles.infoRow}>
              <InfoChip icon="ribbon-outline" label={brandName} sublabel={t.brand} dir={dir} />
              <InfoChip icon="pricetag-outline" label={categoryName} sublabel={t.category} dir={dir} />
            </View>

            {/* Description */}
            {!!product.description && (
              <View style={styles.section} onLayout={measure('description')}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionAccent} />
                  <Text style={[styles.sectionTitle, dir]}>{t.description}</Text>
                </View>
                <View style={styles.descriptionBox}>
                  <Text style={[styles.description, dir]}>{product.description}</Text>
                </View>
              </View>
            )}

            {/* Specs */}
            <View style={styles.section} onLayout={measure('details')}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionAccent} />
                <Text style={[styles.sectionTitle, dir]}>{t.productDetails}</Text>
              </View>
              <View style={styles.specsBox}>
                <SpecRow
                  icon="pricetag-outline"
                  label={t.category}
                  value={categoryName}
                  dir={dir}
                  dirEnd={dirEnd}
                />
                <SpecRow
                  icon="ribbon-outline"
                  label={t.brand}
                  value={brandName}
                  dir={dir}
                  dirEnd={dirEnd}
                />
                <SpecRow
                  icon="location-outline"
                  label={t.location}
                  value={locationName}
                  dir={dir}
                  dirEnd={dirEnd}
                />
                <SpecRow
                  icon="shield-checkmark-outline"
                  label={t.condition}
                  value={conditionLabel}
                  dir={dir}
                  dirEnd={dirEnd}
                />
                <SpecRow
                  icon="calendar-outline"
                  label={locale === 'ar' ? 'نُشر' : 'Posted'}
                  value={formatDate(product.createdAt, locale)}
                  dir={dir}
                  dirEnd={dirEnd}
                />
                <SpecRow
                  icon="time-outline"
                  label={locale === 'ar' ? 'آخر تحديث' : 'Updated'}
                  value={formatDate(product.updatedAt, locale)}
                  dir={dir}
                  dirEnd={dirEnd}
                  last
                />
              </View>
            </View>

            {/* Ratings */}
            <View onLayout={measure('reviews')}>
              <RatingSection
                productId={product.id}
                initialAvg={avg}
                initialCount={ratingsCount}
                ownerId={owner?.id}
              />
            </View>

            {/* Featured stores — spotlight rail (mirrors website product page).
                Guarded so the header/rail collapse cleanly when the endpoint
                returns nothing. */}
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
                          <VerifiedBadge
                            verification={store.verification ?? store.storeProfile?.verification}
                          />
                        </View>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* Similar products — soft-ranked store-first via `storeFirst: true`
                so buyers see verified store listings before individual sellers. */}
            {similarItems.length > 0 && product.category && (
              <View style={styles.railSection} onLayout={measure('similar')}>
                <View style={styles.railHeader}>
                  <Text style={[styles.railTitle, dir]}>
                    {locale === 'ar' ? 'إعلانات مشابهة' : 'Similar Listings'}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/(tabs)/products?categoryId=${product.category!.id}`,
                      )
                    }
                    hitSlop={8}
                  >
                    <Text style={[styles.railLink, dir]}>
                      {locale === 'ar' ? 'عرض الكل ←' : 'View all →'}
                    </Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.railList}
                >
                  {similarItems.map((item) => (
                    <ProductCard
                      key={item.id}
                      product={item}
                      style={styles.similarCard}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </Animated.ScrollView>

        {/* ── Pinned header — product bar + section tabs, shown once the hero scrolls away ── */}
        <Animated.View
          pointerEvents={pinned ? 'box-none' : 'none'}
          style={[styles.pinWrap, { opacity: pinOpacity, transform: [{ translateY: pinShift }] }]}
        >
          <View style={styles.pinBar}>
            <Pressable style={styles.pinBtn} onPress={() => router.back()} hitSlop={4}>
              <Ionicons name={backIcon} size={22} color={colors.white} />
            </Pressable>
            {pinThumb ? (
              <Image
                source={{ uri: pinThumb }}
                style={styles.pinThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.pinThumb} />
            )}
            <View style={styles.pinMeta}>
              <View style={styles.pinTitleRow}>
                <Text style={[styles.pinTitle, dir]} numberOfLines={1}>{product.title}</Text>
                {!!ownerVerification?.verified && <VerifiedSeal size={13} />}
              </View>
              <View style={styles.pinPriceRow}>
                <Text style={[styles.pinPrice, dir]}>
                  {Number(product.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}
                </Text>
                <Text style={[styles.pinCurrency, dir]}>{t.egp}</Text>
              </View>
            </View>
            <View style={styles.pinBtn}>
              <FavoriteButton
                productId={product.id}
                size={20}
                color={colors.white}
                activeColor={colors.error}
              />
            </View>
            <Pressable style={styles.pinBtn} onPress={onShare} hitSlop={4}>
              <Ionicons name="share-social-outline" size={20} color={colors.white} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsRow}
            contentContainerStyle={styles.tabsContent}
          >
            {tabs.map((tab) => {
              const on = tab.key === currentTab
              return (
                <Pressable
                  key={tab.key}
                  style={styles.tab}
                  onPress={() => scrollToSection(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn, dir]}>{tab.label}</Text>
                  {on && <View style={styles.tabLine} />}
                </Pressable>
              )
            })}
          </ScrollView>
        </Animated.View>

        {/* ── Sticky action bar ── */}
        <View
          style={[
            styles.actionBar,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
          ]}
        >
          <View style={styles.actionRow}>
            {owner?.id ? (
              hasPhoneReveal ? (
                <StartChatButton recipientId={owner.id} productId={product.id} iconOnly />
              ) : (
                <View style={styles.actionFlex}>
                  <StartChatButton recipientId={owner.id} productId={product.id} />
                </View>
              )
            ) : null}
            {waLink ? (
              <Pressable
                onPress={() => {
                  trackProductWhatsappClick(product.id)
                  void track({
                    name: 'contact_seller',
                    params: { product_id: product.id, channel: 'whatsapp' },
                  })
                  void bumpEngagement('inquiry')
                  Linking.openURL(waLink).catch(() => {})
                }}
                style={({ pressed }) => [
                  hasPhoneReveal ? styles.waBtn : styles.waBtnWide,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={locale === 'ar' ? 'واتساب' : 'WhatsApp'}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={hasPhoneReveal ? 22 : 18}
                  color={colors.white}
                  style={hasPhoneReveal ? undefined : styles.waIconStart}
                />
                {hasPhoneReveal ? null : (
                  <Text style={styles.waBtnText} numberOfLines={1}>
                    {locale === 'ar' ? 'واتساب' : 'WhatsApp'}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {hasPhoneReveal ? (
              <View style={styles.actionFlex}>
                <RevealPhone
                  productId={product.id}
                  phone={ownerContact}
                  waLink={null}
                  showPhone={product.showPhone}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

interface DirStyle {
  writingDirection: 'rtl' | 'ltr'
  textAlign: 'auto' | 'left' | 'right'
}

function InfoChip({
  icon,
  label,
  sublabel,
  dir,
}: {
  icon: string
  label: string
  sublabel: string
  dir: DirStyle
}) {
  const { colors } = useTheme()
  const { chipStyles } = useStyles()
  return (
    <View style={chipStyles.wrap}>
      <View style={chipStyles.iconSquare}>
        <Ionicons
          name={icon as React.ComponentProps<typeof Ionicons>['name']}
          size={18}
          color={colors.heading}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[chipStyles.sublabel, dir]}>{sublabel}</Text>
        <Text style={[chipStyles.label, dir]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  )
}

function SafetyTip({
  icon,
  text,
  dir,
}: {
  icon: string
  text: string
  dir: DirStyle
}) {
  const { colors } = useTheme()
  const { safetyStyles } = useStyles()
  return (
    <View style={safetyStyles.row}>
      <View style={safetyStyles.bullet}>
        <Ionicons
          name={icon as React.ComponentProps<typeof Ionicons>['name']}
          size={14}
          color={colors.heading}
        />
      </View>
      <Text style={[safetyStyles.text, dir]}>{text}</Text>
    </View>
  )
}

function SpecRow({
  icon,
  label,
  value,
  last,
  dir,
  dirEnd,
}: {
  icon: string
  label: string
  value: string
  last?: boolean
  dir: DirStyle
  dirEnd: DirStyle
}) {
  const { colors } = useTheme()
  const { specStyles } = useStyles()
  return (
    <View style={[specStyles.row, last && specStyles.rowLast]}>
      <View style={specStyles.labelWrap}>
        <View style={specStyles.iconWrap}>
          <Ionicons
            name={icon as React.ComponentProps<typeof Ionicons>['name']}
            size={14}
            color={colors.muted}
          />
        </View>
        <Text style={[specStyles.label, dir]}>{label}</Text>
      </View>
      <Text style={[specStyles.value, dirEnd]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

const makeChipStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    ...(dark ? null : shadow.ss),
  },
  iconSquare: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.yellowBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sublabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
})

const makeSafetyStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
})

const makeSpecStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  value: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
})

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.hero },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  missing: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  expiredTitle: {
    marginTop: spacing.md,
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  expiredHint: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  expiredCta: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.y,
    borderRadius: radius.md,
  },
  expiredCtaText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.dk,
  },

  // ── Image zone ──
  imageZone: {
    backgroundColor: colors.hero,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.y,
    opacity: 0.06,
    top: -80,
    end: -60,
  },
  circle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.y,
    opacity: 0.04,
    bottom: 40,
    start: -40,
  },
  heroImage: {
    width: SCREEN_W,
    height: HERO_H,
  },
  heroPlaceholder: {
    width: SCREEN_W,
    height: HERO_H,
    backgroundColor: colors.dk2,
  },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.xl + spacing.sm,
    start: 0,
    end: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.y,
  },
  counterPill: {
    position: 'absolute',
    bottom: spacing.xl + spacing.sm - 4,
    end: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  counterText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.white,
  },
  floatingHeader: {
    position: 'absolute',
    top: spacing.lg,
    start: spacing.md,
    end: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(6,43,91,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Content card ──
  card: {
    backgroundColor: colors.card,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    marginTop: -(radius.xl),
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    minHeight: 400,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.dot,
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  conditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.y,
  },
  conditionNew: {
    backgroundColor: colors.yellowBg,
    borderColor: colors.y,
  },
  conditionUsed: {
    backgroundColor: colors.placeholder,
    borderColor: colors.dot,
  },
  conditionText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  conditionNewText: { color: colors.heading },
  conditionUsedText: { color: colors.muted },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    backgroundColor: colors.placeholder,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: colors.text,
    lineHeight: 32,
    marginBottom: spacing.sm,
  },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  ratingAvg: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
    marginStart: spacing.xs,
  },
  ratingCount: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginStart: 2,
  },

  // Price block
  priceBlock: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.yellowBg,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...(dark ? null : shadow.ss),
  },
  priceBlockGlow: {
    position: 'absolute',
    top: -40,
    end: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.y,
    opacity: 0.14,
  },
  priceMain: {
    flexShrink: 1,
  },
  priceLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs + 2,
  },
  price: {
    fontFamily: fonts.black,
    fontSize: 32,
    color: colors.price,
    lineHeight: 38,
  },
  currency: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.muted,
  },
  priceAccent: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    ...(dark ? null : shadow.sm),
  },

  // Seller card
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...(dark ? null : shadow.ss),
  },
  sellerLogo: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.yellowBg,
    borderWidth: 2,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sellerLogoImg: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
  },
  sellerLogoFallback: {
    fontSize: 24,
  },
  sellerMain: {
    flex: 1,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  sellerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  sellerVerified: {
    marginBottom: 4,
  },
  sellerBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  sellerSales: {
    marginTop: 4,
  },
  sellerCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sellerCta: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.heading,
  },

  // Safety tips card
  safetyCard: {
    backgroundColor: colors.yellowBg,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...(dark ? null : shadow.ss),
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  safetyIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyTitle: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.heading,
    letterSpacing: 0.1,
  },
  safetyIntro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  safetyList: {
    marginTop: spacing.xs,
  },

  // Info chips row
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.y,
  },
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.1,
  },
  descriptionBox: {
    backgroundColor: colors.placeholder,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 26,
  },
  specsBox: {
    backgroundColor: colors.placeholder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },

  // ── Sticky action bar ──
  actionBar: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...(dark ? null : shadow.md),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
  waBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WA_GREEN,
    borderRadius: radius.lg,
    ...shadow.ss,
  },
  waBtnWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WA_GREEN,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    ...shadow.ss,
  },
  waIconStart: {
    marginEnd: 8,
  },
  waBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },

  // ── Horizontal rails (spotlight stores + similar products) ──
  railSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    // Break out of the card's horizontal padding so the rail can bleed to
    // the screen edges while headers stay flush with the rest of the card.
    marginHorizontal: -spacing.lg,
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
    color: colors.text,
    letterSpacing: 0.1,
  },
  railLink: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.heading,
  },
  railList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

  // Spotlight store card
  spotCard: {
    width: 170,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...(dark ? null : shadow.ss),
  },
  spotCover: {
    position: 'relative',
    height: 90,
    backgroundColor: colors.placeholder,
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
    color: colors.heading,
    minHeight: 30,
  },

  // ProductCard sizing when used inside the similar-products rail — the card
  // itself defers width to the parent (see ProductCard.tsx comment).
  similarCard: {
    width: 180,
  },
  body: { flex: 1 },
  pinWrap: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 20,
  },
  pinBar: {
    height: PIN_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    backgroundColor: colors.hero,
  },
  pinBtn: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: colors.dk2,
  },
  pinMeta: { flex: 1, minWidth: 0, paddingStart: 6 },
  pinTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinTitle: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    lineHeight: 18,
  },
  pinPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  pinPrice: {
    color: colors.y,
    fontFamily: fonts.black,
    fontSize: 17,
    lineHeight: 24,
  },
  pinCurrency: {
    color: colors.y,
    fontFamily: fonts.bold,
    fontSize: 11,
    opacity: 0.85,
  },
  tabsRow: {
    flexGrow: 0,
    height: PIN_TABS_H,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  tabsContent: { paddingHorizontal: 8 },
  tab: {
    height: PIN_TABS_H,
    paddingHorizontal: 8.5,
    justifyContent: 'center',
  },
  tabText: {
    color: colors.muted,
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
  },
  tabTextOn: { color: colors.heading, fontFamily: fonts.extraBold },
  tabLine: {
    position: 'absolute',
    bottom: 0,
    start: 8,
    end: 8,
    height: 3,
    borderTopStartRadius: 3,
    borderTopEndRadius: 3,
    backgroundColor: colors.y,
  },
})

const buildStyles = (c: ThemeColors, dark: boolean) => ({
  chipStyles: makeChipStyles(c, dark),
  safetyStyles: makeSafetyStyles(c),
  specStyles: makeSpecStyles(c),
  styles: makeStyles(c, dark),
})

const themedStyles = { light: buildStyles(lightColors, false), dark: buildStyles(darkColors, true) }

function useStyles() {
  return themedStyles[useTheme().mode]
}
