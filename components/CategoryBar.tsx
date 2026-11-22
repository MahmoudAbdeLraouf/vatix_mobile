import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import type { Category } from '@/lib/api'
import { localeName } from '@/lib/api'
import { useLocale } from '@/contexts/locale'

// Mirrors vatix_website/components/category-bar.tsx + .catbar / .catbar-in / .ci CSS.
// Website uses <Link href="/products?categoryId=X">; mobile uses an onSelect callback.
// Mobile drops the emoji icons in favour of plain pill chips.

interface Props {
  categories: Category[]
  activeCategoryId?: number | null
  onSelect: (id: number | null) => void
  allLabel: string
}

export function CategoryBar({ categories, activeCategoryId, onSelect, allLabel }: Props) {
  const { locale } = useLocale()
  const styles = useStyles()
  const isAllActive = activeCategoryId == null

  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.inner}
      >
        <Chip label={allLabel} active={isAllActive} onPress={() => onSelect(null)} />
        {categories.map(cat => {
          const name = localeName(cat.translations, locale)
          const active = activeCategoryId === cat.id
          return (
            <Chip
              key={cat.id}
              label={name}
              active={active}
              onPress={() => onSelect(cat.id)}
            />
          )
        })}
      </ScrollView>
    </View>
  )
}

interface ChipProps {
  label: string
  active: boolean
  onPress: () => void
}

function Chip({ label, active, onPress }: ChipProps) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && !active && styles.chipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  // Matches the tab header background (colors.hero) so it reads as part of the header.
  bar: {
    backgroundColor: colors.hero,
  },
  inner: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // .ci.on { background: var(--y); color: var(--dk) }
  chipActive: {
    backgroundColor: colors.y,
  },
  chipPressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  chipLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  chipLabelActive: {
    color: colors.dk,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
function useStyles() { return themedStyles[useTheme().mode] }
