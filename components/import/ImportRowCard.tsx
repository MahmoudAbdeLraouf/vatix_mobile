import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const MAX_THUMBS = 3

interface Props {
  rowNumber: number
  title: string
  price: number
  images: string[]
  categoryId: number | null
  brandId: number | null
  categoryOptions: SelectOption[]
  brandOptions: SelectOption[]
  onCategoryChange: (id: number | null) => void
  onBrandChange: (id: number | null) => void
  onRemove: () => void
}

// One preview row, mirroring a row of the website's import table: thumbnails,
// title/price, per-row category + brand and a remove button. Rows missing a
// category or brand get the same red tint as on the website.
export function ImportRowCard({
  rowNumber,
  title,
  price,
  images,
  categoryId,
  brandId,
  categoryOptions,
  brandOptions,
  onCategoryChange,
  onBrandChange,
  onRemove,
}: Props) {
  const { t, locale } = useLocale()
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    // Pin the Text's own direction so 'right' isn't double-flipped by the inherited RTL root.
    direction: 'ltr' as const,
  }
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const missing = categoryId == null || brandId == null
  const thumbs = images.slice(0, MAX_THUMBS)
  const extra = images.length - thumbs.length

  return (
    <View style={[styles.card, missing && styles.cardMissing]}>
      <View style={[styles.topRow, rowDir]}>
        <Text style={styles.rowLabel}>{ip.rowLabel.replace('{row}', String(rowNumber))}</Text>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={ip.removeRow}
        >
          <Text style={styles.removeGlyph}>✕</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, dirStyle]} numberOfLines={2}>
        {title || ip.noTitle}
      </Text>
      <Text style={[styles.price, dirStyle]}>
        {price.toLocaleString(ar ? 'ar-EG' : 'en-US')} {ip.currency}
      </Text>

      {images.length > 0 ? (
        <View style={[styles.thumbs, rowDir]}>
          {thumbs.map((url, i) => (
            <Image key={`${url}-${i}`} source={{ uri: url }} style={styles.thumb} contentFit="cover" />
          ))}
          {extra > 0 ? (
            <View style={[styles.thumb, styles.moreChip]}>
              <Text style={styles.moreText}>+{extra}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <SearchableSelect
        label={ip.category}
        options={categoryOptions}
        value={categoryId != null ? String(categoryId) : ''}
        onChange={(v) => onCategoryChange(v ? Number(v) : null)}
        placeholder={ip.selectCategory}
      />
      <SearchableSelect
        label={ip.brand}
        options={brandOptions}
        value={brandId != null ? String(brandId) : ''}
        onChange={(v) => onBrandChange(v ? Number(v) : null)}
        placeholder={ip.selectBrand}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
  cardMissing: { backgroundColor: colors.rl, borderColor: '#FED7D7' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.g500 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: { fontSize: 13, color: colors.red, fontFamily: fonts.bold },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.dk },
  price: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.g600 },
  thumbs: { flexDirection: 'row', gap: spacing.xs },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.g100 },
  moreChip: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.g200 },
  moreText: { fontFamily: fonts.bold, fontSize: 12, color: colors.g600 },
})
