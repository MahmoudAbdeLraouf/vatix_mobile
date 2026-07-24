import React, { useMemo, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'

// Mirrors vatix_website/components/searchable-select.tsx.
// Trigger acts like a form field; tapping opens a modal sheet with a search input + option list.

export interface SelectOption {
  value: string
  label: string
  sub?: string
}

interface Props {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  style?: ViewStyle
}

export function SearchableSelect({ options, value, onChange, placeholder, label, style }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  // Apply `direction: 'rtl'` locally on this component's own wrapper so the
  // label, trigger row, and option rows resolve start/end correctly. This
  // matches Input.tsx and is reliable because there is no KeyboardAvoidingView
  // between here and the styled children.
  const wrapperDir = ar ? { direction: 'rtl' as const } : null
  // Force LTR flex context + row-reverse on the trigger so the caret/clear
  // icons land on the visual LEFT and the label text sits on the right in
  // Arabic — belt-and-suspenders with wrapperDir.
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const insets = useSafeAreaInsets()

  const selected = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q),
    )
  }, [options, query])

  const searchPlaceholder = locale === 'ar' ? 'ابحث...' : 'Search...'
  const emptyText = locale === 'ar' ? 'لا توجد نتائج' : 'No results'
  const triggerPlaceholder = placeholder ?? (locale === 'ar' ? 'ابحث أو اختر...' : 'Search or select...')

  function close() {
    setOpen(false)
    setQuery('')
  }

  function pick(opt: SelectOption) {
    onChange(opt.value)
    close()
  }

  function clear() {
    onChange('')
    setQuery('')
  }

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <View style={[styles.labelRow, rowDir]}>
          <Text style={[styles.label, dirStyle]}>{label}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, rowDir, pressed && styles.triggerPressed]}
        accessibilityRole="button"
      >
        <Text
          style={[styles.triggerText, dirStyle, !selected && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : triggerPlaceholder}
        </Text>
        {selected ? (
          <Pressable onPress={clear} hitSlop={8} style={styles.clearBtn} accessibilityLabel="clear">
            <Text style={styles.clearGlyph}>✕</Text>
          </Pressable>
        ) : null}
        <Text style={styles.caret}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, wrapperDir, { paddingBottom: insets.bottom + spacing.md, marginTop: insets.top + 60 }]}>
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.g400}
              style={[styles.searchInput, dirStyle]}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
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
                  onPress={() => pick(item)}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && !active && styles.optionPressed,
                  ]}
                >
                  <Text style={[styles.optionLabel, dirStyle, active && styles.optionLabelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.sub ? <Text style={[styles.optionSub, dirStyle]}>{item.sub}</Text> : null}
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: spacing.xs,
  },
  label: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
  },
  // Mirrors .fi input styling (Input.tsx container)
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  triggerPressed: {
    borderColor: colors.y,
  },
  triggerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g900,
  },
  triggerPlaceholder: {
    color: colors.g400,
  },
  clearBtn: {
    marginStart: spacing.sm,
  },
  clearGlyph: {
    fontSize: 14,
    color: colors.g400,
  },
  caret: {
    marginStart: spacing.sm,
    fontSize: 10,
    color: colors.g400,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,43,91,0.32)',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sl,
  },
  searchWrap: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  searchInput: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },
  empty: {
    padding: spacing.md,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g400,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
    backgroundColor: colors.white,
  },
  optionActive: {
    backgroundColor: colors.yl,
  },
  optionPressed: {
    backgroundColor: colors.g50,
  },
  optionLabel: {
    width: '100%',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g700,
  },
  optionLabelActive: {
    fontFamily: fonts.bold,
    color: colors.yd,
  },
  optionSub: {
    width: '100%',
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g400,
  },
})
