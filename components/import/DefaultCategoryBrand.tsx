import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { useLocale } from '@/contexts/locale'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface Props {
  categoryOptions: SelectOption[]
  brandOptions: SelectOption[]
  category: string
  brand: string
  onCategoryChange: (value: string) => void
  onBrandChange: (value: string) => void
}

// Default category/brand pickers. The screens apply the website's behaviour:
// picking a value sets it on every row; clearing leaves rows unchanged.
export function DefaultCategoryBrand({
  categoryOptions,
  brandOptions,
  category,
  brand,
  onCategoryChange,
  onBrandChange,
}: Props) {
  const { t, locale } = useLocale()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    // Pin the Text's own direction so 'right' isn't double-flipped by the inherited RTL root.
    direction: 'ltr' as const,
  }

  return (
    <View style={styles.box}>
      <SearchableSelect
        label={ip.defaultCategory}
        options={categoryOptions}
        value={category}
        onChange={onCategoryChange}
        placeholder={ip.selectCategory}
      />
      <SearchableSelect
        label={ip.defaultBrand}
        options={brandOptions}
        value={brand}
        onChange={onBrandChange}
        placeholder={ip.selectBrand}
      />
      <Text style={[styles.hint, dirStyle]}>{ip.defaultsHint}</Text>
    </View>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  box: {
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
})
