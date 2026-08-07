import React from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Product, imgUrl, localeName } from '@/lib/api'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { getCategoryIcon } from '@/lib/category-icons'

interface ProductCardProps {
  product: Product
  style?: ViewStyle
  variant?: 'grid' | 'row'
}

// Mirrors vatix_website/components/product-card.tsx layout tokens:
// 1:1 image, 12px body padding, 13/700 title (2 lines), 18/900 navy price,
// yl+yd store-plus tag, --ss shadow, 12px radius, 1.5px g200 border.

export const ProductCard = React.memo(function ProductCard({
  product,
  style,
  variant = 'grid',
}: ProductCardProps) {
  const { locale, t, isRtl } = useLocale()
  // Request a ~400px thumbnail from the resize endpoint — grid cells are ~180-
  // 220px wide on mobile so 400px covers @2x/@3x displays without downloading
  // the original 2-4MB upload.
  const thumb = imgUrl(product.images[0]?.url, { w: 400 })
  const categoryName = localeName(product.category.translations, locale)

  const textDirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const isRow = variant === 'row'
  // `owner` may be absent when products come from endpoints that don't join it
  // (e.g. /stores/:id/products). Guard every access to avoid runtime crashes.
  const owner = product.owner
  const isStorePlus = owner?.type === 'store_plus'
  const isStore = owner?.type === 'store'
  const storeName = owner?.storeProfile?.name
  const ownerIcon = isStorePlus ? '⭐' : isStore ? '🏪' : null

  const ratingsCount = product.ratingsCount ?? 0
  const avgRating = product.averageRating ?? 0
  const hasRating = ratingsCount > 0

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isRow && styles.cardRow,
        style,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(`/products/${product.id}`)}
    >
      <View style={[styles.imageWrap, isRow && styles.imageWrapRow]}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={String(product.id)}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons
              name={getCategoryIcon(categoryName)}
              size={isRow ? 40 : 48}
              color={colors.g400}
            />
          </View>
        )}
        {product.promotedUntil && new Date(product.promotedUntil) > new Date() && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t.featured}</Text>
          </View>
        )}
      </View>

      <View style={[styles.info, isRow && styles.infoRow]}>
        <Text
          style={[styles.title, isRow && styles.titleLarge, textDirStyle]}
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
          </View>
        ) : null}

        <Text style={[styles.price, isRow && styles.priceLarge, textDirStyle]}>
          {product.price.toLocaleString()} <Text style={styles.priceUnit}>{t.egp}</Text>
        </Text>
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  // Sizing is deferred to the parent (fixed width in a wrap grid,
  // or flex:1 in a FlatList numColumns row) via the style prop.
  card: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...shadow.ss,
  },
  // Horizontal marketplace-row variant: fixed square image on start, info flex:1.
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  imageWrap: {
    position: 'relative',
    backgroundColor: colors.g100,
  },
  imageWrapRow: {
    width: 128,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.g200,
  },
  // Category-icon fallback: neutral g100 bg + soft g400 glyph — reads as a clean
  // monochrome placeholder rather than competing with the yellow price/tag accents.
  placeholder: {
    backgroundColor: colors.g100,
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
  infoRow: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.g900,
    minHeight: 34,
  },
  titleLarge: {
    fontSize: 14,
    lineHeight: 19,
    minHeight: 0,
  },
  category: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.g500,
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
    color: colors.dk,
  },
  ratingCount: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.g500,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  storeIcon: {
    fontSize: 11,
    lineHeight: 15,
  },
  storeName: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.dk,
    flexShrink: 1,
  },
  price: {
    fontFamily: fonts.black,
    fontSize: 16,
    lineHeight: 22,
    color: colors.dk,
    marginTop: 2,
  },
  priceLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  priceUnit: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.g600,
  },
})
