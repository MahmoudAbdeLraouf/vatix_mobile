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

export function ProductCard({ product, style, variant = 'grid' }: ProductCardProps) {
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

        <Text style={[styles.category, textDirStyle]} numberOfLines={1}>
          {categoryName}
        </Text>

        {storeName ? (
          <View style={[styles.storeTag, isStorePlus && styles.storeTagPlus]}>
            {ownerIcon ? (
              <Text style={[styles.storeIcon, isStorePlus && styles.storeIconPlus]}>
                {ownerIcon}
              </Text>
            ) : null}
            <Text
              style={[styles.storeText, isStorePlus && styles.storeTextPlus, textDirStyle]}
              numberOfLines={1}
            >
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
}

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
    aspectRatio: 4 / 3,
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
  },
  // Store pill: neutral chip for stores, yl+yd for store_plus (matches .prod-tag-plus).
  storeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.g100,
    maxWidth: '100%',
    marginTop: 1,
  },
  storeTagPlus: {
    backgroundColor: colors.yl,
  },
  storeIcon: {
    fontSize: 10,
    color: colors.g600,
  },
  storeIconPlus: {
    color: colors.yd,
  },
  storeText: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.g700,
  },
  storeTextPlus: {
    fontFamily: fonts.extraBold,
    color: colors.yd,
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
