import React from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Product, imgUrl, localeName } from '@/lib/api'
import { useLocale } from '@/contexts/locale'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { getCategoryIcon } from '@/lib/category-icons'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { soldCountText } from '@/lib/salesRecord'
import { FavoriteButton } from '@/components/FavoriteButton'

interface ProductCardProps {
  product: Product
  style?: ViewStyle
  variant?: 'grid' | 'row'
}

// Mirrors vatix_website/components/product-card.tsx layout tokens:
// 1:1 image, 12px body padding, 13/700 title (2 lines), 18/900 navy price,
// --ss shadow, 12px radius, 1.5px g200 border.

// Thumbs that already finished loading this session. iOS expo-image replays the
// fade transition even on memory-cache hits, so a fast fling back over old rows
// would flash every image white again — skip the fade for anything seen before.
const loadedThumbs = new Set<string>()

export const ProductCard = React.memo(function ProductCard({
  product,
  style,
  variant = 'grid',
}: ProductCardProps) {
  return variant === 'row'
    ? <ProductRowCard product={product} style={style} />
    : <ProductGridCard product={product} style={style} />
})

function ProductGridCard({ product, style }: { product: Product; style?: ViewStyle }) {
  const { locale, t, isRtl } = useLocale()
  const { mode, colors } = useTheme()
  const styles = themedStyles[mode]
  // Request a ~400px thumbnail from the resize endpoint — grid cells are ~180-
  // 220px wide on mobile so 400px covers @2x/@3x displays without downloading
  // the original 2-4MB upload.
  const thumb = imgUrl(product.images[0]?.url, { w: 400 })
  const categoryName = localeName(product.category.translations, locale)

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  // `owner` may be absent when products come from endpoints that don't join it
  // (e.g. /stores/:id/products). Guard every access to avoid runtime crashes.
  const owner = product.owner
  const isStore = owner?.type === 'store'
  const storeName = owner?.storeProfile?.name
  const verification = owner?.storeProfile?.verification ?? owner?.verification
  const ownerIcon = isStore ? '🏪' : null
  // `owner.salesRecord` is omitted by the backend when the sales-record flag is off.
  const salesTotal = isStore ? (owner?.salesRecord?.total ?? 0) : 0

  const ratingsCount = product.ratingsCount ?? 0
  const avgRating = product.averageRating ?? 0
  const hasRating = ratingsCount > 0

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(`/products/${product.id}`)}
    >
      <View style={styles.imageWrap}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={loadedThumbs.has(thumb) ? 0 : 150}
            onLoad={() => loadedThumbs.add(thumb)}
            recyclingKey={String(product.id)}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons
              name={getCategoryIcon(categoryName)}
              size={48}
              color={colors.subtle}
            />
          </View>
        )}
        {product.promotedUntil && new Date(product.promotedUntil) > new Date() && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t.featured}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text
          style={[styles.title, textDirStyle]}
          numberOfLines={2}
        >
          {product.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.category, textDirStyle]} numberOfLines={1}>
            {categoryName}
          </Text>
          {hasRating ? (
            <View style={styles.ratingPill}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({ratingsCount})</Text>
            </View>
          ) : null}
        </View>

        {storeName ? (
          <View style={styles.storeRow}>
            {ownerIcon ? <Text style={styles.storeIcon}>{ownerIcon}</Text> : null}
            <Text style={[styles.storeName, textDirStyle]} numberOfLines={1}>
              {storeName}
            </Text>
            {isStore && verification?.verified ? (
              <View style={styles.verifiedWrap}>
                <VerifiedBadge verification={verification} />
              </View>
            ) : null}
          </View>
        ) : null}

        {storeName && salesTotal > 0 ? (
          <Text style={[styles.soldLine, textDirStyle]} numberOfLines={1}>
            {soldCountText(t.salesRecord.cardSold, salesTotal, t.salesRecord)}
          </Text>
        ) : null}

        <Text style={[styles.price, textDirStyle]}>
          {Number(product.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')} <Text style={styles.priceUnit}>{t.egp}</Text>
        </Text>
      </View>
    </Pressable>
  )
}

// Marketplace list row (Products tab): cover thumb + price-first info column, and
// a full-width store bar under store listings so the seller reads at a glance.
// Client listings get no bar — "individual seller" sits on the location line.
function ProductRowCard({ product, style }: { product: Product; style?: ViewStyle }) {
  const { locale, t, isRtl } = useLocale()
  const { mode, colors } = useTheme()
  const styles = themedRowStyles[mode]
  const thumb = imgUrl(product.images[0]?.url, { w: 400 })
  const photoCount = product.images.length
  const categoryName = localeName(product.category.translations, locale)
  const locationName = product.location ? localeName(product.location.translations, locale) : ''
  const isPromoted = !!product.promotedUntil && new Date(product.promotedUntil) > new Date()

  const isNew = product.condition === 'new'
  const conditionLabel =
    {
      new: t.conditionNew,
      used_excellent: t.conditionUsedExcellent,
      used_good: t.conditionUsedGood,
      used_acceptable: t.conditionUsedAcceptable,
    }[product.condition ?? ''] ?? t.conditionUsed

  const owner = product.owner
  const isStore = owner?.type === 'store' && !!owner.storeProfile
  const storeName = owner?.storeProfile?.name
  const storeLogo = imgUrl(owner?.storeProfile?.logo, { w: 96 })
  const verification = owner?.storeProfile?.verification ?? owner?.verification
  // `owner.salesRecord` is omitted by the backend when the sales-record flag is off.
  const salesTotal = isStore ? (owner?.salesRecord?.total ?? 0) : 0

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
      onPress={() => router.push(`/products/${product.id}`)}
    >
      <View style={styles.top}>
        <View style={styles.thumbWrap}>
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={loadedThumbs.has(thumb) ? 0 : 150}
              onLoad={() => loadedThumbs.add(thumb)}
              recyclingKey={String(product.id)}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name={getCategoryIcon(categoryName)} size={40} color={colors.subtle} />
            </View>
          )}
          {isPromoted ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>⭐ {t.featured}</Text>
            </View>
          ) : null}
          {photoCount > 1 ? (
            <View style={styles.photoChip}>
              <Ionicons name="camera" size={11} color="#fff" />
              <Text style={styles.photoChipText}>{photoCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, textDirStyle]} numberOfLines={1}>
              {Number(product.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}{' '}
              <Text style={styles.priceUnit}>{t.egp}</Text>
            </Text>
            <FavoriteButton productId={product.id} size={20} color={colors.muted} style={styles.heart} />
          </View>

          <Text style={[styles.title, textDirStyle]} numberOfLines={2}>
            {product.title}
          </Text>

          <View style={styles.meta}>
            <View style={styles.metaLine}>
              <View style={[styles.conditionDot, !isNew && styles.conditionDotUsed]} />
              <Text style={styles.condition} numberOfLines={1}>{conditionLabel}</Text>
              <View style={styles.sep} />
              <Text style={styles.metaMuted} numberOfLines={1}>{timeAgo(product.createdAt, t)}</Text>
            </View>
            {locationName || !isStore ? (
              <View style={styles.metaLine}>
                {locationName ? (
                  <>
                    <Ionicons name="location-outline" size={12} color={colors.subtle} />
                    <Text style={[styles.metaMuted, styles.shrink]} numberOfLines={1}>{locationName}</Text>
                  </>
                ) : null}
                {locationName && !isStore ? <View style={styles.sep} /> : null}
                {!isStore ? (
                  <Text style={styles.metaMuted} numberOfLines={1}>{t.individualSeller}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {isStore && owner ? (
        <Pressable
          style={({ pressed }) => [styles.storeBar, pressed && styles.storeBarPressed]}
          onPress={() => router.push(`/store/${owner.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${t.visitStore}: ${storeName ?? ''}`}
        >
          <View style={styles.logoRing}>
            {storeLogo ? (
              <Image source={{ uri: storeLogo }} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.logo, styles.logoFallback]}>
                <Ionicons name="storefront" size={14} color={colors.subtle} />
              </View>
            )}
          </View>
          <View style={styles.storeNameWrap}>
            <Text style={[styles.storeName, textDirStyle]} numberOfLines={1}>
              {storeName}
            </Text>
            {verification?.verified ? (
              <View style={styles.verifiedCheck} accessibilityLabel={t.verified.badge}>
                <Text style={styles.verifiedCheckText}>✓</Text>
              </View>
            ) : null}
          </View>
          {salesTotal > 0 ? (
            <View style={styles.soldPill}>
              <Text style={styles.soldPillText} numberOfLines={1}>
                {soldCountText(t.salesRecord.cardSold, salesTotal, t.salesRecord)}
              </Text>
            </View>
          ) : (
            <View style={styles.visit}>
              <Text style={styles.visitText}>{t.visitStore}</Text>
              <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={12} color={styles.visitText.color} />
            </View>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  )
}

function timeAgo(iso: string, t: ReturnType<typeof useLocale>['t']) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return t.minutesAgo(m)
  if (m < 1440) return t.hoursAgo(Math.floor(m / 60))
  return t.daysAgo(Math.floor(m / 1440))
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  // Sizing is deferred to the parent (fixed width in a wrap grid,
  // or flex:1 in a FlatList numColumns row) via the style prop.
  card: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    // Dark cards separate by border alone; navy shadows vanish on a navy page.
    ...(dark ? null : shadow.ss),
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  imageWrap: {
    position: 'relative',
    backgroundColor: colors.card,
    padding: 12,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.placeholder,
  },
  // Category-icon fallback: neutral g100 bg + soft g400 glyph — reads as a clean
  // monochrome placeholder rather than competing with the yellow price/tag accents.
  placeholder: {
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    backgroundColor: colors.y,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    ...shadow.ss,
  },
  badgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: colors.dk,
    letterSpacing: 0.2,
  },
  info: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.text,
    minHeight: 34,
  },
  category: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingStar: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.y,
  },
  ratingValue: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.heading,
  },
  ratingCount: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.muted,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  verifiedWrap: {
    flexShrink: 0,
  },
  storeIcon: {
    fontSize: 11,
    lineHeight: 15,
  },
  storeName: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.heading,
    flexShrink: 1,
  },
  soldLine: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.yellowText,
    marginTop: 2,
  },
  price: {
    fontFamily: fonts.black,
    fontSize: 16,
    lineHeight: 22,
    color: colors.price,
    marginTop: 2,
  },
  priceUnit: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.muted,
  },
})

// Built once per theme — this card renders in long lists.
const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }

const makeRowStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
    // Light: soft lift, no border. Dark: border only — shadows vanish on navy.
    ...(dark
      ? { borderWidth: 1, borderColor: colors.border }
      : {
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 2,
        }),
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  top: {
    flexDirection: 'row',
    padding: 10,
    gap: 12,
  },
  thumbWrap: {
    width: 112,
    height: 112,
  },
  thumb: {
    width: 112,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.placeholder,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: 6,
    start: 6,
    backgroundColor: colors.y,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
    ...shadow.ss,
  },
  featuredText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    lineHeight: 16,
    color: colors.dk,
  },
  photoChip: {
    position: 'absolute',
    bottom: 6,
    start: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16,24,40,0.6)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  photoChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 15,
    color: '#fff',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  price: {
    flexShrink: 1,
    fontFamily: fonts.black,
    fontSize: 20,
    lineHeight: 26,
    color: colors.price,
  },
  priceUnit: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.muted,
  },
  heart: {
    width: 30,
    height: 30,
    marginEnd: -4,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  meta: {
    marginTop: 'auto',
    gap: 2,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  conditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  conditionDotUsed: {
    backgroundColor: colors.yd,
  },
  condition: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    flexShrink: 1,
  },
  sep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.dot,
  },
  metaMuted: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.subtle,
  },
  shrink: {
    flexShrink: 1,
  },
  storeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    backgroundColor: dark ? colors.pressed : '#F3F6FB',
    borderTopWidth: 1,
    borderTopColor: dark ? colors.border : '#E4EAF3',
  },
  storeBarPressed: {
    opacity: 0.8,
  },
  logoRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: dark ? colors.border : '#D3DDEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: dark ? colors.card : '#fff',
    backgroundColor: colors.placeholder,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeNameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  storeName: {
    flexShrink: 1,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.heading,
  },
  // Compact form of VerifiedBadge (same navy + light ring) — the full pill would
  // crowd the store name off a 1-line bar.
  verifiedCheck: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#1A2540',
    alignItems: 'center',
    justifyContent: 'center',
    ...(dark ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' } : null),
  },
  verifiedCheckText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
    color: '#fff',
    includeFontPadding: false,
  },
  soldPill: {
    flexShrink: 0,
    maxWidth: '55%',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: dark ? colors.yellowBg : '#FFF3C4',
    borderColor: dark ? 'rgba(245,184,0,0.35)' : '#F6DD85',
  },
  soldPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 15,
    color: dark ? colors.y : colors.yt,
  },
  visit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    opacity: 0.7,
  },
  visitText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.heading,
  },
})

const themedRowStyles = { light: makeRowStyles(lightColors, false), dark: makeRowStyles(darkColors, true) }
