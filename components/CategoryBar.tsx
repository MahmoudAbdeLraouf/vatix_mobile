import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import type { Category } from '@/lib/api'
import { localeName } from '@/lib/api'
import { useLocale } from '@/contexts/locale'

// Mirrors vatix_website/components/category-bar.tsx + .catbar / .catbar-in / .ci CSS.
// Website uses <Link href="/products?categoryId=X">; mobile uses an onSelect callback.

const ICONS: Record<string, string> = {
  'هواتف': '📱', 'لابتوبات': '💻', 'شاشات': '🖥️', 'ألعاب': '🎮',
  'كاميرات': '📷', 'صوتيات': '🎧', 'ساعات': '⌚', 'إكسسوارات': '🔋',
  'طابعات': '🖨️', 'شبكات': '📡', 'أجهزة': '📱', 'المنزل': '🏠',
  'Phones': '📱', 'Laptops': '💻', 'Screens': '🖥️', 'Gaming': '🎮',
  'Cameras': '📷', 'Audio': '🎧', 'Watches': '⌚', 'Accessories': '🔋',
  'Printers': '🖨️', 'Networking': '📡', 'Home': '🏠',
}

function getIcon(name: string) {
  const key = Object.keys(ICONS).find(k => name.includes(k))
  return key ? ICONS[key] : '📦'
}

interface Props {
  categories: Category[]
  activeCategoryId?: number | null
  onSelect: (id: number | null) => void
  allLabel: string
}

export function CategoryBar({ categories, activeCategoryId, onSelect, allLabel }: Props) {
  const { locale } = useLocale()
  const isAllActive = activeCategoryId == null

  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.inner}
      >
        <Chip label={allLabel} icon="🏠" active={isAllActive} onPress={() => onSelect(null)} />
        {categories.map(cat => {
          const name = localeName(cat.translations, locale)
          const active = activeCategoryId === cat.id
          return (
            <Chip
              key={cat.id}
              label={name}
              icon={getIcon(name)}
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
  icon: string
  active: boolean
  onPress: () => void
}

function Chip({ label, icon, active, onPress }: ChipProps) {
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
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Matches the tab header background (colors.dk) so it reads as part of the header.
  bar: {
    backgroundColor: colors.dk,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  // .catbar-in { padding: 0 28px; height: 48; gap: 2 (approx) }
  inner: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    height: 60,
    gap: spacing.xs,
  },
  // .ci { padding: 5 12; radius: 7; gap: 5; font-size: 12; weight: 600; color: rgba(255,255,255,.6) }
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  // .ci.on { background: var(--y); color: var(--dk) }
  chipActive: {
    backgroundColor: colors.y,
  },
  chipPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipIcon: {
    fontSize: 13,
    marginEnd: 6,
  },
  chipLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  chipLabelActive: {
    color: colors.dk,
  },
})
