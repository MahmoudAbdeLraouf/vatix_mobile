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

/** Setup card when nothing is known yet, otherwise the interests bar + "تمام؟" hint above the 🎯 tab. */
export function MatchPrefsStrip({ prefs, categories, brands, total, onEdit, onSkip, onSaved }: {
  prefs: MatchPrefs
  categories: Category[]
  brands: Brand[]
  /** Open requests on the board, shown on the setup card. */
  total?: number
  onEdit: () => void
  onSkip: () => void
  onSaved: (prefs: MatchPrefs) => void
}) {
  const { locale, t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir, colDir } = useBroDir()
  const styles = useStyles()
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  if (prefs.categoryIds.length === 0 && prefs.brandIds.length === 0) {
    return (
      <View style={styles.setup}>
        <View style={[styles.setupHead, rowDir]}>
          <Text style={styles.setupEmoji}>🎯</Text>
          <View style={[styles.setupText, colDir]}>
            <Text style={[styles.setupTitle, dirStyle]}>{b.setupTitle}</Text>
            <Text style={[styles.setupBody, dirStyle]}>{b.setupBody}</Text>
          </View>
        </View>
        <View style={styles.setupPanel}>
          {total != null && (
            <>
              <Text style={styles.setupCount}>{total.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}</Text>
              <Text style={styles.setupCountLabel}>{b.setupOpenCount}</Text>
            </>
          )}
          <View style={styles.setupCta}>
            <BroButton label={b.interestsSetupCta} variant="yellow" size="md" onPress={onEdit} />
          </View>
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={styles.setupSkip}>{b.setupSkip}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  async function confirm() {
    setSaving(true)
    setSaveFailed(false)
    try {
      onSaved(await saveMatchPrefs({ categoryIds: prefs.categoryIds, brandIds: prefs.brandIds }))
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
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
    <View style={styles.bar}>
      <View style={[styles.strip, rowDir]}>
        <Text style={[styles.stripLabel, dirStyle]}>{b.mbarLabel}</Text>
        {chips.map((c, i) => (
          <View key={`${c}-${i}`} style={[styles.onPill, rowDir]}>
            <Text style={styles.onPillTick}>✓</Text>
            <Text style={styles.onPillText}>{c}</Text>
          </View>
        ))}
        <Pressable onPress={onEdit} hitSlop={6} accessibilityRole="button" style={styles.editBtn}>
          <Text style={styles.editText}>{b.interestsEdit}</Text>
        </Pressable>
      </View>
      {!prefs.isManual && (
        <View style={[styles.hint, rowDir]}>
          <Text style={[styles.hintText, dirStyle]}>
            🎯 <Text style={styles.hintBold}>{b.interestsHintBold}</Text> {b.interestsHintAsk}
          </Text>
          <View style={[styles.hintLinks, rowDir]}>
            <Pressable onPress={confirm} disabled={saving} hitSlop={6} accessibilityRole="button">
              <Text style={[styles.link, saving && styles.linkBusy]}>{b.interestsConfirmYes}</Text>
            </Pressable>
            <Text style={styles.hintText}>·</Text>
            <Pressable onPress={onEdit} disabled={saving} hitSlop={6} accessibilityRole="button">
              <Text style={styles.link}>{b.interestsConfirmEdit}</Text>
            </Pressable>
          </View>
          {saveFailed && <Text style={styles.error} accessibilityRole="alert">{b.prefsSaveFailed}</Text>}
        </View>
      )}
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
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.y,
    overflow: 'hidden',
  },
  setupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18 },
  setupEmoji: { fontSize: 32, lineHeight: 38 },
  setupText: { flex: 1, minWidth: 0 },
  setupTitle: { fontFamily: fonts.black, fontSize: 18, lineHeight: 26, color: colors.heading },
  setupBody: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 4 },
  setupPanel: {
    alignItems: 'center',
    gap: 4,
    padding: 18,
    backgroundColor: dark ? 'rgba(245,184,0,0.12)' : colors.yl,
    borderTopWidth: 1,
    borderTopColor: dark ? 'rgba(245,184,0,0.35)' : '#f6d77a',
  },
  setupCount: { fontFamily: fonts.black, fontSize: 40, lineHeight: 50, color: colors.heading },
  setupCountLabel: { fontFamily: fonts.extraBold, fontSize: 13, color: dark ? colors.yellowText : '#8a5a00' },
  setupCta: { alignSelf: 'stretch', marginTop: 8 },
  setupSkip: { fontFamily: fonts.extraBold, fontSize: 12.5, color: colors.muted, marginTop: 6 },
  bar: { gap: 10 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stripLabel: { fontFamily: fonts.black, fontSize: 13.5, color: colors.heading },
  onPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.dk,
    borderWidth: 1.5,
    borderColor: dark ? colors.dk3 : colors.dk,
  },
  onPillTick: { fontFamily: fonts.black, fontSize: 13, color: colors.y },
  onPillText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.white },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: dark ? colors.border : '#c7d4f8',
    backgroundColor: colors.card,
  },
  editText: { fontFamily: fonts.black, fontSize: 13, color: dark ? '#8fb0ff' : '#2952cc' },
  hint: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  hintText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  hintBold: { fontFamily: fonts.black, color: colors.heading },
  hintLinks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontFamily: fonts.black, fontSize: 13.5, color: dark ? '#8fb0ff' : '#2952cc' },
  linkBusy: { opacity: 0.5 },
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
