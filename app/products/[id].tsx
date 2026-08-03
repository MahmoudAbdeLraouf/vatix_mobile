import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { getProduct, imgUrl, localeName, Product, ProductImage } from '@/lib/api'
import { trackProductView } from '@/lib/analytics'
import { FavoriteButton } from '@/components/FavoriteButton'
import { MessagesBell } from '@/components/MessagesBell'
import { RevealPhone } from '@/components/RevealPhone'
import { StartChatButton } from '@/components/StartChatButton'
import { StarRating } from '@/components/StarRating'
import { RatingSection } from '@/components/RatingSection'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const { width: SCREEN_W } = Dimensions.get('window')
const HERO_H = 340

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
  const { user } = useAuth()
  const { requireLogin } = useLoginGate()
  const insets = useSafeAreaInsets()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const galleryRef = useRef<FlatList<ProductImage>>(null)

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

  useEffect(() => {
    if (!id) return
    getProduct(Number(id))
      .then(setProduct)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const pid = Number(id)
    if (Number.isFinite(pid) && pid > 0) trackProductView(pid)
  }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.y} size="large" />
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
  const isStore = owner?.type === 'store' || owner?.type === 'store_plus'
  const storeName =
    owner?.storeProfile?.name ??
    (owner?.clientProfile
      ? `${owner.clientProfile.firstName ?? ''} ${owner.clientProfile.lastName ?? ''}`.trim()
      : '')
  const storeLogo = imgUrl(owner?.storeProfile?.logo)
  const ownerBadge =
    owner?.type === 'store_plus'
      ? { label: locale === 'ar' ? 'متجر مميز ⭐' : 'Store Plus ⭐', bg: colors.yl, fg: colors.dk }
      : isStore
      ? { label: locale === 'ar' ? 'متجر 🏪' : 'Store 🏪', bg: colors.g100, fg: colors.g700 }
      : { label: locale === 'ar' ? 'فرد 👤' : 'Individual 👤', bg: colors.g100, fg: colors.g700 }

  // Parity with website: WA link is gated by showPhone and falls back to phone
  // when the seller hasn't provided a dedicated WhatsApp number.
  const waSource = product.showPhone ? owner?.whatsapp || owner?.phone : null
  const waLink = buildWaLink(
    waSource,
    product.title,
    product.price,
    product.slug ?? product.id,
    locale === 'ar',
  )
  const hasPhoneReveal = product.showPhone && !!owner?.phone
  const hasActions = !!owner?.id || !!waLink || hasPhoneReveal
  const bottomBarH =
    Math.max(insets.bottom, spacing.md) + 56 + spacing.md + spacing.lg + spacing.md

  const avg = product.averageRating ?? 0
  const ratingsCount = product.ratingsCount ?? 0

  const onGalleryScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    const i = Math.round(x / SCREEN_W)
    if (i !== imgIndex) setImgIndex(i)
  }

  const scrollToImage = (i: number) => {
    setImgIndex(i)
    galleryRef.current?.scrollToOffset({ offset: i * SCREEN_W, animated: true })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
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
              keyExtractor={(img) => String(img.id)}
              renderItem={({ item }) => {
                const u = imgUrl(item.url)
                return u ? (
                  <Image source={{ uri: u }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                  <View style={styles.heroPlaceholder} />
                )
              }}
              onMomentumScrollEnd={onGalleryScrollEnd}
              getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
              // FlatList caches direction; force LTR-ordered paging regardless of
              // app-wide RTL so index 0 is always the first image.
              inverted={false}
            />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}

          {/* Bottom fade — smooths the transition into the white card. */}
          <View pointerEvents="none" style={styles.heroFade} />

          {/* Page dots */}
          {images.length > 1 && (
            <View pointerEvents="none" style={styles.dotsRow}>
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
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                const url = `${SITE_URL}/products/${product.slug ?? product.id}`
                Share.share({ message: url, url, title: product.title }).catch(() => {})
              }}
              hitSlop={8}
            >
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

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <ScrollView
              horizontal
              style={styles.thumbList}
              contentContainerStyle={styles.thumbListContent}
              showsHorizontalScrollIndicator={false}
            >
              {images.map((img, i) => (
                <Pressable key={img.id} onPress={() => scrollToImage(i)}>
                  <Image
                    source={{ uri: imgUrl(img.url) ?? undefined }}
                    style={[styles.thumb, i === imgIndex && styles.thumbActive]}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── White content card ── */}
        <View style={styles.card}>
          <View style={styles.handle} />

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
              <Ionicons name="location-outline" size={12} color={colors.g500} />
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
                <Text style={[styles.price, dir]}>{product.price.toLocaleString()}</Text>
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
          {!!owner?.id && (
            isStore ? (
              <Pressable
                onPress={() => router.push(`/store/${owner.id}`)}
                style={({ pressed }) => [styles.sellerCard, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.sellerLogo}>
                  {storeLogo ? (
                    <Image source={{ uri: storeLogo }} style={styles.sellerLogoImg} />
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
                  <View style={styles.sellerCtaRow}>
                    <Text style={[styles.sellerCta, dir]}>{t.visit}</Text>
                    <Ionicons name={forwardIcon} size={13} color={colors.dk} />
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
            )
          )}

          {/* Brand + Category chips */}
          <View style={styles.infoRow}>
            <InfoChip icon="ribbon-outline" label={brandName} sublabel={t.brand} dir={dir} />
            <InfoChip icon="pricetag-outline" label={categoryName} sublabel={t.category} dir={dir} />
          </View>

          {/* Description */}
          {!!product.description && (
            <View style={styles.section}>
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
          <View style={styles.section}>
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
          <RatingSection
            productId={product.id}
            initialAvg={avg}
            initialCount={ratingsCount}
            ownerId={owner?.id}
          />
        </View>
      </ScrollView>

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
                if (!requireLogin()) return
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
                phone={owner?.phone ?? null}
                waLink={null}
                showPhone={product.showPhone}
              />
            </View>
          ) : null}
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
  return (
    <View style={chipStyles.wrap}>
      <View style={chipStyles.iconSquare}>
        <Ionicons
          name={icon as React.ComponentProps<typeof Ionicons>['name']}
          size={18}
          color={colors.dk}
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
  return (
    <View style={[specStyles.row, last && specStyles.rowLast]}>
      <View style={specStyles.labelWrap}>
        <View style={specStyles.iconWrap}>
          <Ionicons
            name={icon as React.ComponentProps<typeof Ionicons>['name']}
            size={14}
            color={colors.g500}
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

const chipStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.sm + 2,
    ...shadow.ss,
  },
  iconSquare: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sublabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.g500,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.g900,
    marginTop: 2,
  },
})

const specStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.g200,
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
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.g200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
  },
  value: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g900,
  },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dk },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  missing: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g500,
  },

  // ── Image zone ──
  imageZone: {
    backgroundColor: colors.dk,
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
  heroFade: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    height: 90,
    backgroundColor: colors.dk,
    opacity: 0.35,
  },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.lg + 68,
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
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.y,
  },
  counterPill: {
    position: 'absolute',
    bottom: spacing.lg + 60,
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
    top: spacing.md,
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
  thumbList: {
    paddingVertical: spacing.sm,
  },
  thumbListContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.55,
  },
  thumbActive: {
    borderColor: colors.y,
    opacity: 1,
  },

  // ── Content card ──
  card: {
    backgroundColor: colors.white,
    borderTopStartRadius: radius.xl + 4,
    borderTopEndRadius: radius.xl + 4,
    marginTop: -(radius.xl + 4),
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
    backgroundColor: colors.g300,
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
    backgroundColor: colors.yl,
    borderColor: colors.y,
  },
  conditionUsed: {
    backgroundColor: colors.g100,
    borderColor: colors.g300,
  },
  conditionText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  conditionNewText: { color: colors.dk },
  conditionUsedText: { color: colors.g600 },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    backgroundColor: colors.g100,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  locationText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g600,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: colors.g900,
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
    color: colors.g900,
    marginStart: spacing.xs,
  },
  ratingCount: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    marginStart: 2,
  },

  // Price block
  priceBlock: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadow.ss,
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
    color: colors.g600,
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
    color: colors.dk,
    lineHeight: 38,
  },
  currency: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.g600,
  },
  priceAccent: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  // Seller card
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.ss,
  },
  sellerLogo: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
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
    color: colors.g900,
  },
  sellerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  sellerBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  sellerCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sellerCta: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.dk,
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
    color: colors.g900,
    letterSpacing: 0.1,
  },
  descriptionBox: {
    backgroundColor: colors.g100,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g700,
    lineHeight: 26,
  },
  specsBox: {
    backgroundColor: colors.g100,
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
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.g200,
    ...shadow.md,
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
})
