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
import { CardContact } from '@/components/CardContact'

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

        <CardContact product={product} iconOnly style={styles.contact} />
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

// Marketplace list row (Products tab, My Ads): square thumb + title-first info
// column, then a footer with the seller (avatar + name) and round call /
// WhatsApp / chat buttons. Promoted rows get a warm amber card.
function ProductRowCard({ product, style }: { product: Product; style?: ViewStyle }) {
  const { locale, t, isRtl } = useLocale()
  const { mode, colors } = useTheme()
  const styles = themedRowStyles[mode]
  const ar = locale === 'ar'
  const thumb = imgUrl(product.images[0]?.url, { w: 400 })
  const photoCount = product.images.length
  const locationName = product.location ? localeName(product.location.translations, locale) : ''
  const isPromoted = !!product.promotedUntil && new Date(product.promotedUntil) > new Date()

  const conditionLabel =
    {
      new: t.conditionNew,
      used_excellent: t.conditionUsedExcellent,
      used_good: t.conditionUsedGood,
      used_acceptable: t.conditionUsedAcceptable,
    }[product.condition ?? ''] ?? t.conditionUsed
  const metaLine = [conditionLabel, timeAgo(product.createdAt, t), locationName].filter(Boolean).join(' • ')

  const owner = product.owner
  const isStore = owner?.type === 'store' && !!owner.storeProfile
  const clientName = [owner?.clientProfile?.firstName, owner?.clientProfile?.lastName].filter(Boolean).join(' ')
  const sellerName = isStore ? (owner?.storeProfile?.name ?? '') : clientName || t.individualSeller
  const storeLogo = isStore ? imgUrl(owner?.storeProfile?.logo, { w: 96 }) : null
  const avatarLetter = isStore || clientName ? [...sellerName.trim()][0]?.toUpperCase() : undefined
  const verification = owner?.storeProfile?.verification ?? owner?.verification
  // `owner.salesRecord` is omitted by the backend when the sales-record flag is off.
  const salesTotal = isStore ? (owner?.salesRecord?.total ?? 0) : 0

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const seller = (
    <>
      {storeLogo ? (
        <Image source={{ uri: storeLogo }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          {avatarLetter ? (
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          ) : (
            <Ionicons name="person" size={16} color={styles.avatarText.color} />
          )}
        </View>
      )}
      <View style={styles.sellerText}>
        <View style={styles.sellerNameRow}>
          <Text style={[styles.sellerName, textDirStyle]} numberOfLines={1}>
            {sellerName}
          </Text>
          {isStore && verification?.verified ? (
            <View style={styles.verifiedSeal} accessibilityLabel={t.verified.badge}>
              <VerifiedSeal size={15} />
            </View>
          ) : null}
        </View>
        {salesTotal > 0 ? (
          <Text style={[styles.sold, textDirStyle]} numberOfLines={1}>
            {soldCountText(t.salesRecord.cardSold, salesTotal, t.salesRecord)}
          </Text>
        ) : null}
      </View>
      {isStore ? (
        <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.subtle} />
      ) : null}
    </>
  )

  return (
    <Pressable
      style={({ pressed }) => [styles.card, isPromoted && styles.cardPromoted, style, pressed && styles.cardPressed]}
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
              <Ionicons name="image-outline" size={36} color={styles.thumbIcon.color} />
            </View>
          )}
          {/* Icon + text instead of a "★" emoji inside the Text — Android dropped the Arabic
              glyphs of the mixed emoji/Arabic run on some recycled rows, leaving only the star. */}
          {isPromoted ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText} numberOfLines={1}>{t.featured}</Text>
              <Ionicons name="star" size={10} color={styles.featuredText.color} />
            </View>
          ) : null}
          {photoCount > 1 ? (
            <View style={styles.photoChip}>
              <Text style={styles.photoChipText}>{ar ? `${photoCount} صور` : `${photoCount} photos`}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, textDirStyle]} numberOfLines={2}>
              {product.title}
            </Text>
            <FavoriteButton productId={product.id} size={22} color={colors.muted} style={styles.heart} />
          </View>

          <Text style={[styles.price, textDirStyle]} numberOfLines={1}>
            {Number(product.price).toLocaleString(ar ? 'ar-EG' : 'en-EG')}{' '}
            <Text style={styles.priceUnit}>{t.egp}</Text>
          </Text>

          <Text style={[styles.meta, textDirStyle]} numberOfLines={1}>
            {metaLine}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        {isStore && owner ? (
          <Pressable
            style={({ pressed }) => [styles.seller, pressed && styles.sellerPressed]}
            onPress={() => router.push(`/store/${owner.id}`)}
            accessibilityRole="link"
            accessibilityLabel={`${t.visitStore}: ${sellerName}`}
          >
            {seller}
          </Pressable>
        ) : (
          <View style={styles.seller}>{seller}</View>
        )}
        <CardContact product={product} variant="round" />
      </View>
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
    backgroundColor: colors.y,
    paddingHorizontal: 9,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tagText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    lineHeight: 16,
    color: colors.dk,
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
    flexGrow: 1,
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
  // Pinned to the card foot so the buttons line up across a grid row even when
  // one card has a sold pill and its neighbour doesn't.
  contact: {
    marginTop: 'auto',
    paddingTop: 8,
  },
})

// Built once per theme — this card renders in long lists.
const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }

const ROW_THUMB = 120

const makeRowStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    overflow: 'hidden',
    borderWidth: 1,
    // Light: soft lift with a near-invisible edge. Dark: border only — shadows vanish on navy.
    borderColor: dark ? colors.border : 'transparent',
    ...(dark
      ? null
      : {
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 2,
        }),
  },
  cardPromoted: {
    backgroundColor: dark ? '#282D35' : '#FFFAEB',
    borderColor: dark ? 'rgba(245,184,0,0.35)' : '#F0C14B',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  top: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  thumbWrap: {
    width: ROW_THUMB,
    height: ROW_THUMB,
  },
  thumb: {
    width: ROW_THUMB,
    height: ROW_THUMB,
    borderRadius: radius.lg,
    backgroundColor: dark ? colors.placeholder : '#EEF2F8',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    color: dark ? colors.subtle : '#A9B6CC',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    start: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.y,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    ...shadow.ss,
  },
  featuredText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.dk,
    includeFontPadding: false,
  },
  photoChip: {
    position: 'absolute',
    bottom: 8,
    end: 8,
    backgroundColor: 'rgba(16,24,40,0.65)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  photoChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 16,
    color: '#fff',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  heart: {
    width: 30,
    height: 30,
    marginTop: -4,
    marginEnd: -4,
  },
  price: {
    fontFamily: fonts.black,
    fontSize: 22,
    lineHeight: 30,
    color: colors.price,
  },
  priceUnit: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  meta: {
    marginTop: 'auto',
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    backgroundColor: dark ? colors.border : colors.g200,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  seller: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sellerPressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.placeholder,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark ? colors.blueBg : '#E8F0FE',
  },
  avatarText: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: dark ? '#7FB0FF' : '#1257D6',
  },
  sellerText: {
    flexShrink: 1,
    minWidth: 0,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.heading,
  },
  // Bare VerifiedSeal — the full pill would crowd the name in the footer.
  verifiedSeal: { flexShrink: 0 },
  sold: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.yellowText,
  },
})

const themedRowStyles = { light: makeRowStyles(lightColors, false), dark: makeRowStyles(darkColors, true) }
