import { useState, type Dispatch, type SetStateAction } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { localeName, type Brand, type Category } from '@/lib/api'
import { resetMatchPrefs, saveMatchPrefs, type MatchPrefs } from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
import { useBroDir } from '@/components/bro/BroCardParts'
import { darkColors, fonts, lightColors, radius, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const MAX_PICKS = 20

/** Interests line above the 🎯 tab, or a setup card when nothing is known yet. */
export function MatchPrefsStrip({ prefs, categories, brands, onEdit }: {
  prefs: MatchPrefs
  categories: Category[]
  brands: Brand[]
  onEdit: () => void
}) {
  const { locale, t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir, colDir } = useBroDir()
  const styles = useStyles()

  if (prefs.categoryIds.length === 0 && prefs.brandIds.length === 0) {
    return (
      <View style={[styles.setup, rowDir]}>
        <Text style={styles.setupEmoji}>🎯</Text>
        <View style={[styles.setupText, colDir]}>
          <Text style={[styles.setupTitle, dirStyle]}>{b.interestsSetupTitle}</Text>
          <Text style={[styles.setupBody, dirStyle]}>{b.interestsSetupBody}</Text>
        </View>
        <BroButton label={b.interestsSetupCta} variant="yellow" onPress={onEdit} />
      </View>
    )
  }

  const catName = new Map(categories.map(c => [c.id, localeName(c.translations, locale)]))
  const brandName = new Map(brands.map(br => [br.id, localeName(br.translations, locale)]))
  const chips = [
    ...prefs.categoryIds.map(id => catName.get(id)).filter((n): n is string => !!n),
    ...(prefs.brandIds.length
      ? prefs.brandIds.map(id => brandName.get(id)).filter((n): n is string => !!n)
      : [b.interestsAllBrands]),
  ]

  return (
    <View style={[styles.strip, rowDir]}>
      <Text style={[styles.stripLabel, dirStyle]}>{b.interestsLabel}</Text>
      {chips.map((c, i) => (
        <Text key={`${c}-${i}`} style={styles.stripChip}>{c}</Text>
      ))}
      {!prefs.isManual && <Text style={styles.stripInferred}>{b.interestsInferred}</Text>}
      <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
        <Text style={styles.stripEdit}>{b.interestsEdit}</Text>
      </Pressable>
    </View>
  )
}

function ChipPicker({ title, hint, options, picked, onToggle }: {
  title: string
  hint?: string
  options: { id: number; label: string }[]
  picked: number[]
  onToggle: (id: number) => void
}) {
  const { t } = useLocale()
  const { dirStyle, rowDir } = useBroDir()
  const styles = useStyles()
  const full = picked.length >= MAX_PICKS
  return (
    <View style={styles.picker}>
      <View style={[styles.pickerHead, rowDir]}>
        <Text style={[styles.pickerTitle, dirStyle]}>{title}</Text>
        <Text style={styles.pickerCount}>
          {picked.length} · {t.bro.prefsMax.replace('{n}', String(MAX_PICKS))}
        </Text>
      </View>
      {hint ? <Text style={[styles.pickerHint, dirStyle]}>{hint}</Text> : null}
      <View style={[styles.chips, rowDir]}>
        {options.map(o => {
          const on = picked.includes(o.id)
          const disabled = !on && full
          return (
            <Pressable
              key={o.id}
              onPress={() => onToggle(o.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled }}
              style={[styles.chip, on && styles.chipOn, disabled && styles.chipOff]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? '✓ ' : ''}{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** Multi-select editor for the 🎯 tab's categories + brands. */
export function MatchPrefsModal({ visible, prefs, categories, brands, onClose, onSaved }: {
  visible: boolean
  prefs: MatchPrefs
  categories: Category[]
  brands: Brand[]
  onClose: () => void
  onSaved: (prefs: MatchPrefs) => void
}) {
  // Remount per open so the picks start from the saved prefs.
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && <PrefsBody prefs={prefs} categories={categories} brands={brands} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  )
}

function PrefsBody({ prefs, categories, brands, onClose, onSaved }: {
  prefs: MatchPrefs
  categories: Category[]
  brands: Brand[]
  onClose: () => void
  onSaved: (prefs: MatchPrefs) => void
}) {
  const { locale, t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const [cats, setCats] = useState<number[]>(prefs.categoryIds)
  const [brandIds, setBrandIds] = useState<number[]>(prefs.brandIds)
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = (set: Dispatch<SetStateAction<number[]>>) => (id: number) => {
    setError(null)
    set(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_PICKS ? prev : [...prev, id])
  }

  async function save() {
    if (cats.length === 0 && brandIds.length === 0) { setError(b.prefsNeedCategory); return }
    setBusy('save')
    setError(null)
    try {
      onSaved(await saveMatchPrefs({ categoryIds: cats, brandIds }))
    } catch {
      setError(b.prefsSaveFailed)
      setBusy(null)
    }
  }

  async function reset() {
    setBusy('reset')
    setError(null)
    const next = await resetMatchPrefs()
    if (next) onSaved(next)
    else { setError(b.prefsSaveFailed); setBusy(null) }
  }

  const close = () => { if (!busy) onClose() }

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={b.sheetClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, rowDir]}>
          <Text style={[styles.headerTitle, dirStyle]}>🎯 {b.prefsTitle}</Text>
          <Pressable onPress={close} disabled={!!busy} hitSlop={10} accessibilityRole="button" accessibilityLabel={b.sheetClose}>
            <Text style={styles.headerClose}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <ChipPicker
            title={b.prefsCategories}
            picked={cats}
            onToggle={toggle(setCats)}
            options={categories.map(c => ({ id: c.id, label: localeName(c.translations, locale) }))}
          />
          <ChipPicker
            title={b.prefsBrands}
            hint={b.prefsBrandsHint}
            picked={brandIds}
            onToggle={toggle(setBrandIds)}
            options={brands.map(br => ({ id: br.id, label: localeName(br.translations, locale) }))}
          />
        </ScrollView>
        <View style={styles.footer}>
          {error ? <Text style={[styles.error, dirStyle]} accessibilityRole="alert">{error}</Text> : null}
          <View style={[styles.footerRow, rowDir]}>
            {prefs.isManual && (
              <Pressable onPress={reset} disabled={!!busy} hitSlop={8} accessibilityRole="button">
                <Text style={styles.reset}>{b.prefsReset}</Text>
              </Pressable>
            )}
            <View style={styles.spacer} />
            <BroButton label={b.prefsCancel} onPress={close} disabled={!!busy} size="md" />
            <BroButton
              label={busy === 'save' ? b.prefsSaving : b.prefsSave}
              onPress={save}
              disabled={!!busy}
              variant="yellow"
              size="md"
            />
          </View>
        </View>
      </View>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  setup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: dark ? 'rgba(245,184,0,0.12)' : colors.yl,
    borderWidth: 1,
    borderColor: dark ? 'rgba(245,184,0,0.35)' : '#fde68a',
  },
  setupEmoji: { fontSize: 28 },
  setupText: { flex: 1, minWidth: 0 },
  setupTitle: { fontFamily: fonts.black, fontSize: 15, color: colors.heading },
  setupBody: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted, marginTop: 2 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stripLabel: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.muted },
  stripChip: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.heading,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  stripInferred: { fontFamily: fonts.bold, fontSize: 12, color: colors.subtle },
  stripEdit: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.yd, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontFamily: fonts.black, fontSize: 17, color: colors.heading },
  headerClose: { fontSize: 26, lineHeight: 28, color: colors.muted },
  body: { paddingHorizontal: 20, paddingVertical: 16 },
  picker: { marginBottom: 18 },
  pickerHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  pickerTitle: { fontFamily: fonts.black, fontSize: 14, color: colors.heading },
  pickerCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.subtle },
  pickerHint: { fontFamily: fonts.semiBold, fontSize: 12.5, color: colors.muted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.dk, borderColor: colors.dk },
  chipOff: { opacity: 0.45 },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  chipTextOn: { color: colors.white },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  reset: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: colors.red },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().isDark ? 'dark' : 'light']
}
