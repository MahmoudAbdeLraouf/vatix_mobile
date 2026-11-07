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
import { soldCountText } from '@/lib/salesRecord'
import { FavoriteButton } from '@/components/FavoriteButton'
import { VerifiedSeal } from '@/components/VerifiedBadge'

interface ProductCardProps {
  product: Product
  style?: ViewStyle
  variant?: 'grid' | 'row'
  // Grid only: wide 4:3 photo + gold hairline, for the home "Featured" strip.
  featured?: boolean
  // Grid only: card rendered on the store's own page. The store row and sold pill
  // would repeat the header, so show a brand label and condition · ★ · time instead.
  inStore?: boolean
}

// Grid card ("luxury" home redesign): padded white card with a soft navy shadow,
// framed photo, price-first body, and a store row (logo + name + ✓ + sold pill)
// for store listings or a condition · area · time line for individual sellers.

// Thumbs that already finished loading this session. iOS expo-image replays the
// fade transition even on memory-cache hits, so a fast fling back over old rows
// would flash every image white again — skip the fade for anything seen before.
const loadedThumbs = new Set<string>()

export const ProductCard = React.memo(function ProductCard({
  product,
  style,
  variant = 'grid',
  featured = false,
  inStore = false,
}: ProductCardProps) {
  return variant === 'row'
    ? <ProductRowCard product={product} style={style} />
    : <ProductGridCard product={product} style={style} featured={featured} inStore={inStore} />
})

function ProductGridCard({
  product,
  style,
  featured,
  inStore,
}: {
  product: Product
  style?: ViewStyle
  featured: boolean
  inStore: boolean
}) {
  const { locale, t, isRtl } = useLocale()
  const { mode, colors } = useTheme()
  const styles = themedStyles[mode]
  // Request a ~400px thumbnail from the resize endpoint — grid cells are ~180-
  // 220px wide on mobile so 400px covers @2x/@3x displays without downloading
  // the original 2-4MB upload.
  const thumb = imgUrl(product.images[0]?.url, { w: 400 })
  const locationName = product.location ? localeName(product.location.translations, locale) : ''
  const isPromoted = !!product.promotedUntil && new Date(product.promotedUntil) > new Date()
  const brandName = inStore && product.brand ? localeName(product.brand.translations ?? [], locale) : ''
  const hasRating = (product.ratingsCount ?? 0) > 0 && product.averageRating != null

  const isNew = product.condition === 'new'
  const conditionLabel =
    {
      new: t.conditionNew,
      used_excellent: t.conditionUsedExcellent,
      used_good: t.conditionUsedGood,
      used_acceptable: t.conditionUsedAcceptable,
    }[product.condition ?? ''] ?? t.conditionUsed

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  // `owner` may be absent when products come from endpoints that don't join it
  // (e.g. /stores/:id/products). Guard every access to avoid runtime crashes.
  const owner = product.owner
  const isStore = owner?.type === 'store' && !!owner.storeProfile?.name
  const storeName = owner?.storeProfile?.name ?? ''
  const storeLogo = imgUrl(owner?.storeProfile?.logo, { w: 96 })
  const verification = owner?.storeProfile?.verification ?? owner?.verification
  // `owner.salesRecord` is omitted by the backend when the sales-record flag is off.
  const salesTotal = isStore ? (owner?.salesRecord?.total ?? 0) : 0

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        featured && styles.cardFeatured,
        style,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(`/products/${product.id}`)}
    >
      <View style={[styles.photo, featured && styles.photoFeatured]}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={loadedThumbs.has(thumb) ? 0 : 150}
            onLoad={() => loadedThumbs.add(thumb)}
            recyclingKey={String(product.id)}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name={getCategoryIcon(product.category)} size={44} color={colors.subtle} />
          </View>
        )}
        {isPromoted ? (
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>{t.featured}</Text>
          </View>
        ) : null}
        <FavoriteButton productId={product.id} size={16} color={colors.g600} style={styles.heart} />
      </View>

      <View style={styles.body}>
        {brandName ? (
          <Text style={[styles.brand, textDirStyle]} numberOfLines={1}>
            {brandName.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[styles.price, textDirStyle]} numberOfLines={1}>
          {Number(product.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-EG')}{' '}
          <Text style={styles.priceUnit}>{t.egp}</Text>
        </Text>

        <Text style={[styles.title, textDirStyle]} numberOfLines={2}>
          {product.title}
        </Text>

        {inStore ? (
          <Text style={[styles.meta, textDirStyle]} numberOfLines={1}>
            <Text style={isNew ? styles.condNew : styles.condUsed}>{conditionLabel}</Text>
            {hasRating ? ' · ' : ''}
            {hasRating ? <Text style={styles.rating}>★ {Number(product.averageRating).toFixed(1)}</Text> : null}
            {` · ${timeAgo(product.createdAt, t)}`}
          </Text>
        ) : isStore && owner ? (
          <>
            <View style={styles.storeRow}>
              {storeLogo ? (
                <Image source={{ uri: storeLogo }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials(storeName)}</Text>
                </View>
              )}
              <Text style={[styles.storeName, textDirStyle]} numberOfLines={1}>
                {storeName}
              </Text>
              {verification?.verified ? (
                <View style={styles.verifiedSeal} accessibilityLabel={t.verified.badge}>
                  <VerifiedSeal size={14} />
                </View>
              ) : null}
            </View>
            {salesTotal > 0 ? (
              <View style={styles.soldPill}>
                <Text style={styles.soldPillText} numberOfLines={1}>
                  {soldCountText(t.salesRecord.cardSold, salesTotal, t.salesRecord)}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.meta, textDirStyle]} numberOfLines={1}>
            <Text style={isNew ? styles.condNew : styles.condUsed}>{conditionLabel}</Text>
            {locationName ? ` · ${locationName}` : ''}
            {` · ${timeAgo(product.createdAt, t)}`}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

// Two-letter monogram for stores without a logo ("Phone Corner" → "PC").
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '•'
  const letters = parts.length === 1 ? [...parts[0]].slice(0, 2) : [[...parts[0]][0], [...parts[1]][0]]
  return letters.join('').toUpperCase()
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
              <Ionicons name={getCategoryIcon(product.category)} size={40} color={colors.subtle} />
            </View>
          )}
          {isPromoted ? (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={10} color={styles.featuredText.color} />
              <Text style={styles.featuredText} numberOfLines={1}>{t.featured}</Text>
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
              <View style={styles.verifiedSeal} accessibilityLabel={t.verified.badge}>
                <VerifiedSeal size={16} />
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
  // Sizing is deferred to the parent (fixed width in a strip, or flex:1 in a
  // FlatList numColumns row) via the style prop.
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: 6,
    // Dark cards separate by border alone; navy shadows vanish on a navy page.
    ...(dark
      ? { borderWidth: 1, borderColor: colors.border }
      : {
          shadowColor: colors.dk,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 12,
          elevation: 2,
        }),
  },
  // Gold hairline + slightly deeper shadow for the Featured strip.
  cardFeatured: {
    borderWidth: 1,
    borderColor: dark ? 'rgba(233,199,102,0.45)' : '#E9C766',
    ...(dark
      ? null
      : { shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 }),
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  photo: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: dark ? colors.placeholder : '#F2F4F7',
  },
  photoFeatured: {
    aspectRatio: 4 / 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: 6,
    start: 6,
    backgroundColor: colors.dk,
    paddingHorizontal: 9,
    paddingVertical: 1,
    borderRadius: 6,
    ...(dark ? { borderWidth: 1, borderColor: 'rgba(245,184,0,0.35)' } : null),
  },
  tagText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    lineHeight: 16,
    color: colors.y,
  },
  heart: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 8,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  price: {
    fontFamily: fonts.black,
    fontSize: 16,
    lineHeight: 22,
    color: colors.price,
  },
  priceUnit: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.subtle,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34,
    marginTop: 2,
    color: dark ? colors.muted : colors.g600,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.subtle,
    marginTop: 6,
  },
  condNew: {
    fontFamily: fonts.bold,
    color: dark ? colors.green : '#067647',
  },
  condUsed: {
    fontFamily: fonts.bold,
    color: dark ? '#F79009' : '#B54708',
  },
  rating: {
    fontFamily: fonts.extraBold,
    color: colors.yellowText,
  },
  brand: {
    fontFamily: fonts.extraBold,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 1.2,
    color: colors.subtle,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: dark ? colors.border : '#F2F4F7',
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.placeholder,
  },
  avatarFallback: {
    backgroundColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
    ...(dark ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' } : null),
  },
  avatarText: {
    fontFamily: fonts.black,
    fontSize: 8,
    lineHeight: 11,
    color: colors.y,
    includeFontPadding: false,
  },
  storeName: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.heading,
    flexShrink: 1,
  },
  verifiedSeal: { flexShrink: 0 },
  soldPill: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 6,
    maxWidth: '100%',
    backgroundColor: dark ? colors.yellowBg : '#FFF8E1',
  },
  soldPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    lineHeight: 16,
    color: colors.yellowText,
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
  // Icon + text instead of a "⭐" emoji inside the Text — Android dropped the Arabic
  // glyphs of the mixed emoji/Arabic run on some recycled rows, leaving only the star.
  featuredBadge: {
    position: 'absolute',
    top: 6,
    start: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.y,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    ...shadow.ss,
  },
  featuredText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: colors.dk,
    includeFontPadding: false,
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
  // Inset panel inside the card's white frame — a full-bleed strip in a near-page-bg
  // tint read as sitting outside the card on iOS.
  storeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: dark ? colors.pressed : '#EAF0F9',
    borderColor: dark ? colors.border : '#D6E0EF',
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
  // Bare VerifiedSeal — the full pill would crowd the store name off a 1-line bar.
  verifiedSeal: { flexShrink: 0 },
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
    color: colors.yellowText,
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
