import React, { useMemo, useState } from 'react'
import {
  FlatList,
  I18nManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'

// Mirrors vatix_website/components/filter-combobox.tsx.
// Compact chip trigger used in the catalog filter row; opens a modal sheet
// with a search box + option list. Active option matches website: --yl bg,
// --yd bold label, --y borderStart accent.

export interface ComboOption {
  value: string
  label: string
}

interface Props {
  options: ComboOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  style?: ViewStyle
}

export function FilterCombobox({ options, value, onChange, placeholder, style }: Props) {
  const { locale, isRtl } = useLocale()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  // Modal on Android doesn't always inherit I18nManager.isRTL, so when the locale
  // direction differs from the native mirror state, flip rows manually.
  const needsManualReverse = isRtl !== I18nManager.isRTL
  const rowDir: 'row' | 'row-reverse' = needsManualReverse ? 'row-reverse' : 'row'
  const textDirStyle = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }

  const selected = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  const searchPlaceholder = locale === 'ar' ? 'ابحث...' : 'Search...'
  const emptyText = locale === 'ar' ? 'لا توجد نتائج' : 'No results'
  const clearLabel = locale === 'ar' ? 'مسح' : 'Clear'

  function close() {
    setOpen(false)
    setQuery('')
  }

  function pick(v: string) {
    onChange(v)
    close()
  }

  function clear(e?: any) {
    e?.stopPropagation?.()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <View style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.chip,
          selected && styles.chipActive,
          pressed && styles.chipPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={selected ? selected.label : placeholder}
      >
        <Text
          style={[
            styles.chipLabel,
            selected ? styles.chipLabelActive : styles.chipLabelPlaceholder,
            textDirStyle,
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        {selected ? (
          <Pressable
            onPress={clear}
            hitSlop={8}
            style={styles.clearBtn}
            accessibilityLabel={clearLabel}
          >
            <Text style={styles.clearGlyph}>✕</Text>
          </Pressable>
        ) : null}
        <Text style={styles.caret}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md, marginTop: insets.top + 60 }]}>
          <View style={styles.searchWrap}>
            <View style={[styles.searchRow, { flexDirection: rowDir }]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.subtle}
                style={[styles.searchInput, textDirStyle]}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
              {selected ? (
                <Pressable
                  onPress={clear}
                  style={({ pressed }) => [
                    styles.sheetClearBtn,
                    pressed && styles.sheetClearBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={clearLabel}
                >
                  <Text style={styles.sheetClearGlyph}>✕</Text>
                  <Text style={styles.sheetClearText}>{clearLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
            renderItem={({ item }) => {
              const active = item.value === value
              return (
                <Pressable
                  onPress={() => pick(item.value)}
                  style={({ pressed }) => [
                    styles.option,
                    { flexDirection: rowDir },
                    active && styles.optionActive,
                    pressed && !active && styles.optionPressed,
                  ]}
                >
                  <View style={[styles.optionAccent, active && styles.optionAccentActive]} />
                  <Text
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                      textDirStyle,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {active ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  // Filter chip trigger — matches the priceInput dimensions on the products page
  // so brand / location / min / max all share the same 42-tall, --g200 bordered look.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
  },
  chipPressed: {
    borderColor: colors.dot,
  },
  chipLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
  chipLabelActive: {
    fontFamily: fonts.bold,
    color: dark ? colors.y : colors.yd,
  },
  chipLabelPlaceholder: {
    color: colors.muted,
    fontFamily: fonts.semiBold,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: spacing.xs,
  },
  clearGlyph: {
    fontSize: 12,
    color: colors.muted,
  },
  caret: {
    marginStart: spacing.xs,
    fontSize: 9,
    color: colors.subtle,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    ...(dark ? null : shadow.sl),
  },
  searchWrap: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  searchRow: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
  sheetClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sheetClearBtnPressed: {
    backgroundColor: colors.pressed,
  },
  sheetClearGlyph: {
    fontSize: 12,
    color: colors.muted,
  },
  sheetClearText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.text,
  },
  empty: {
    padding: spacing.md,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.subtle,
  },
  // Website active option: bg --yl, color --yd, bold, borderInlineStart 3px --y
  option: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  optionActive: {
    backgroundColor: colors.yellowBg,
  },
  optionPressed: {
    backgroundColor: colors.pressed,
  },
  optionAccent: {
    width: 3,
    height: 24,
    backgroundColor: 'transparent',
  },
  optionAccentActive: {
    backgroundColor: colors.y,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
  optionLabelActive: {
    fontFamily: fonts.bold,
    color: dark ? colors.y : colors.yd,
  },
  optionCheck: {
    fontSize: 14,
    color: colors.y,
  },
})
