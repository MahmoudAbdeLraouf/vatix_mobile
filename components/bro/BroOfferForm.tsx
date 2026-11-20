import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { getLocations, imgUrl, localeName, type LocationNode } from '@/lib/api'
import { budgetFitOf, uploadBroOfferImages, type BroScratches, type OfferContent } from '@/lib/bro'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { BroButton } from './BroButton'
import { useBroDir } from './BroCardParts'

// Mirrors vatix_website/components/bro/bro-offer-form.tsx.

const MAX_PHOTOS = 5
const MAX_PRICE = 10_000_000
const PRICE_RE = /^\d+(\.\d{1,2})?$/
const SCRATCHES: BroScratches[] = ['none', 'minor', 'repaired']
const FIT_COLOR = { in: '#16a34a', near: '#ca8a04', over: '#ea580c' } as const

/** Green zone = the buyer's budget, dot = the seller's price. */
function BudgetBar({ price, min, max }: { price: number; min: number | null; max: number }) {
  const { locale, t } = useLocale()
  const styles = useStyles()
  const b = t.bro
  const { ar, dirStyle, rowDir } = useBroDir()
  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')
  const fit = budgetFitOf(price, max)
  const scale = Math.max(max * 1.4, price * 1.05)
  const pct = (n: number) => Math.min(100, Math.max(0, (n / scale) * 100))
  const lo = min != null && min < max ? min : 0
  // The track is pinned to ltr, so the start edge is picked by hand.
  const start = (n: number) => (ar ? { right: `${pct(n)}%` as const } : { left: `${pct(n)}%` as const })
  const amount = min != null && min < max
    ? b.budgetAmtRange.replace('{min}', nf(min)).replace('{max}', nf(max))
    : b.budgetAmtUpTo.replace('{max}', nf(max))
  return (
    <View style={styles.budget}>
      <View style={styles.budgetTrack}>
        <View style={[styles.budgetZone, start(lo), { width: `${pct(max) - pct(lo)}%` }]} />
        {fit ? (
          <View style={[styles.budgetDot, start(price), ar ? { marginRight: -7 } : { marginLeft: -7 }, { backgroundColor: FIT_COLOR[fit] }]} />
        ) : null}
      </View>
      <View style={[styles.budgetLabels, rowDir]}>
        <Text style={[styles.budgetBuyer, dirStyle]}>{b.budgetBarBuyer}: {amount} {b.budgetCurrency}</Text>
        {fit ? (
          <Text style={[styles.budgetFit, { color: FIT_COLOR[fit] }]}>
            {fit === 'in' ? b.fitIn : fit === 'near' ? b.fitNear : b.fitOver}
          </Text>
        ) : null}
      </View>
      {fit === 'over' ? (
        <Text style={[styles.budgetWarn, dirStyle]}>{b.overBudgetWarn.replace('{max}', nf(max))}</Text>
      ) : null}
    </View>
  )
}

export function BroOfferForm({
  initial,
  productImages,
  showSave,
  showSaveProduct = false,
  onSubmit,
  error,
  onUploadingChange,
  submitLabel,
  budget,
}: {
  initial: OfferContent
  productImages: string[]
  showSave: boolean
  showSaveProduct?: boolean
  onSubmit: (content: OfferContent, saveAsTemplate: boolean, saveAsProduct: boolean) => Promise<void>
  error?: string | null
  onUploadingChange?: (uploading: boolean) => void
  submitLabel?: { idle: string; busy: string }
  /** The buyer's budget: shows where the typed price lands against it. */
  budget?: { min: number | null; max: number | null }
}) {
  const { t, locale } = useLocale()
  const { colors } = useTheme()
  const styles = useStyles()
  const b = t.bro
  const { ar, dirStyle, rowDir } = useBroDir()
  // Inputs use explicit alignment: TextInput gravity is absolute on Android, so 'right' is right either way.
  const inputDir = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: ar ? ('right' as const) : ('left' as const) }

  const [title, setTitle] = useState(initial.title ?? '')
  const [price, setPrice] = useState(Number(initial.price) > 0 ? String(Number(initial.price)) : '')
  const [locationId, setLocationId] = useState(initial.locationId ? String(initial.locationId) : '')
  const [scratches, setScratches] = useState<BroScratches | null>(initial.scratches ?? null)
  const [hasBox, setHasBox] = useState(!!initial.hasBox)
  const [hasInvoice, setHasInvoice] = useState(!!initial.hasInvoice)
  const [hasWarranty, setHasWarranty] = useState(!!initial.hasWarranty)
  const [warrantyNote, setWarrantyNote] = useState(initial.warrantyNote ?? '')
  const [note, setNote] = useState(initial.sellerNote ?? '')
  const [images, setImages] = useState<string[]>(
    (initial.images && initial.images.length > 0 ? initial.images : productImages).slice(0, MAX_PHOTOS),
  )
  const [save, setSave] = useState(true)
  const [saveProduct, setSaveProduct] = useState(true)
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [locationsFailed, setLocationsFailed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    let alive = true
    getLocations()
      .then(list => { if (alive) setLocations(list.filter(l => l.isActive)) })
      .catch(() => { if (alive) setLocationsFailed(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => { onUploadingChange?.(uploading) }, [uploading, onUploadingChange])

  const locationOptions = useMemo(() => {
    const byId = new Map(locations.map(l => [l.id, l]))
    return locations.map(l => {
      const parent = l.parentId != null ? byId.get(l.parentId) : undefined
      return {
        value: String(l.id),
        label: localeName(l.translations, locale),
        sub: parent ? localeName(parent.translations, locale) : undefined,
      }
    })
  }, [locations, locale])

  const trimmedTitle = title.trim()
  const titleOk = trimmedTitle.length >= 2 && trimmedTitle.length <= 150
  const priceNum = Number(price)
  const priceOk = PRICE_RE.test(price.trim()) && priceNum > 0 && priceNum <= MAX_PRICE
  const locked = busy || uploading

  async function addPhotos() {
    const remaining = MAX_PHOTOS - images.length
    if (remaining <= 0 || locked) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t.permissionRequired, t.allowPhotoAccess)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    })
    if (result.canceled || result.assets.length === 0) return
    setUploading(true)
    setUploadError(false)
    try {
      const urls = await uploadBroOfferImages(
        result.assets.slice(0, remaining).map(a => ({
          uri: a.uri,
          mimeType: a.mimeType ?? undefined,
          fileName: a.fileName ?? undefined,
        })),
      )
      setImages(prev => [...prev, ...urls].slice(0, MAX_PHOTOS))
    } catch {
      setUploadError(true)
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (locked) return
    if (!titleOk || !priceOk) {
      setShowErrors(true)
      return
    }
    setBusy(true)
    try {
      await onSubmit(
        {
          title: trimmedTitle,
          price: priceNum,
          locationId: locationId ? Number(locationId) : null,
          scratches,
          hasBox,
          hasInvoice,
          hasWarranty,
          warrantyNote: hasWarranty && warrantyNote.trim() ? warrantyNote.trim() : null,
          sellerNote: note.trim() || null,
          images,
          productId: initial.productId ?? null,
        },
        showSave && save,
        showSaveProduct && saveProduct,
      )
    } finally {
      setBusy(false)
    }
  }

  const scratchLabel: Record<BroScratches, string> = {
    none: b.scratchesNone,
    minor: b.scratchesMinor,
    repaired: b.scratchesRepaired,
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{b.offerTitleLabel}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={b.offerTitlePlaceholder}
          placeholderTextColor={colors.subtle}
          maxLength={150}
          editable={!locked}
          style={[styles.input, inputDir, showErrors && !titleOk && styles.inputError]}
        />
        {showErrors && !titleOk ? <Text style={[styles.err, dirStyle]}>{b.errOfferTitle}</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{b.offerPriceLabel}</Text>
        <TextInput
          value={price}
          onChangeText={v => setPrice(v.replace(/[^\d.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.subtle}
          editable={!locked}
          style={[styles.input, inputDir, showErrors && !priceOk && styles.inputError]}
        />
        {showErrors && !priceOk ? <Text style={[styles.err, dirStyle]}>{b.errOfferPrice}</Text> : null}
        {budget?.max != null && budget.max > 0 ? (
          <BudgetBar price={priceOk ? priceNum : 0} min={budget.min} max={budget.max} />
        ) : null}
      </View>

      <View style={styles.field}>
        <SearchableSelect
          label={b.offerAreaLabel}
          options={locationOptions}
          value={locationId}
          onChange={setLocationId}
          placeholder={b.offerAreaPlaceholder}
        />
        {locationsFailed ? <Text style={[styles.err, dirStyle]}>{b.areasLoadFailed}</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{b.fieldScratches}</Text>
        <View style={[styles.chips, rowDir]}>
          {SCRATCHES.map(s => (
            <BroButton
              key={s}
              chip
              selected={scratches === s}
              label={scratchLabel[s]}
              disabled={locked}
              onPress={() => setScratches(prev => (prev === s ? null : s))}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{b.fieldExtras}</Text>
        <View style={[styles.chips, rowDir]}>
          <BroButton chip selected={hasBox} label={`📦 ${b.extraBox}`} disabled={locked} onPress={() => setHasBox(v => !v)} />
          <BroButton chip selected={hasInvoice} label={`🧾 ${b.extraInvoice}`} disabled={locked} onPress={() => setHasInvoice(v => !v)} />
          <BroButton chip selected={hasWarranty} label={`🛡️ ${b.extraWarranty}`} disabled={locked} onPress={() => setHasWarranty(v => !v)} />
        </View>
      </View>

      {hasWarranty ? (
        <View style={styles.field}>
          <Text style={[styles.label, dirStyle]}>{b.fieldWarrantyNote}</Text>
          <TextInput
            value={warrantyNote}
            onChangeText={setWarrantyNote}
            maxLength={60}
            editable={!locked}
            style={[styles.input, inputDir]}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{b.fieldNote}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={280}
          multiline
          editable={!locked}
          style={[styles.input, styles.textarea, inputDir]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>
          {b.offerPhotosLabel} · {b.offerPhotosHint.replace('{max}', String(MAX_PHOTOS))}
        </Text>
        <View style={[styles.photos, rowDir]}>
          {images.map(url => {
            const src = imgUrl(url, { w: 128 })
            return (
              <View key={url} style={styles.thumb}>
                {src ? <Image source={{ uri: src }} style={styles.thumbImg} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={b.removePhoto}
                  disabled={locked}
                  onPress={() => setImages(prev => prev.filter(u => u !== url))}
                  style={styles.thumbRemove}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={12} color={colors.white} />
                </Pressable>
              </View>
            )
          })}
        </View>
        <BroButton
          label={uploading ? b.uploadingPhotos : `+ ${b.addPhotos}`}
          icon="images-outline"
          disabled={locked || images.length >= MAX_PHOTOS}
          onPress={addPhotos}
        />
        {uploadError ? <Text style={[styles.err, dirStyle]}>{b.photosUploadFailed}</Text> : null}
      </View>

      {showSave ? (
        <CheckRow label={b.saveOffer} checked={save} disabled={locked} onToggle={() => setSave(v => !v)} />
      ) : null}
      {showSaveProduct ? (
        <CheckRow label={b.saveAsProduct} checked={saveProduct} disabled={locked} onToggle={() => setSaveProduct(v => !v)} />
      ) : null}

      {error ? <Text style={[styles.err, styles.submitErr, dirStyle]}>{error}</Text> : null}

      <BroButton
        variant="yellow"
        size="md"
        fullWidth
        disabled={locked}
        label={busy ? (submitLabel?.busy ?? b.offerSubmitting) : (submitLabel?.idle ?? b.offerSubmit)}
        onPress={submit}
      />
    </View>
  )
}

function CheckRow({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  const { ar, rowDir } = useBroDir()
  const { colors } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={[styles.checkRow, rowDir]}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.heading : colors.subtle} />
      <Text style={[styles.checkLabel, { writingDirection: ar ? 'rtl' : 'ltr', textAlign: ar ? 'right' : 'left' }]}>{label}</Text>
    </Pressable>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: spacing.md },
  field: { gap: 6 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.heading,
    backgroundColor: colors.inputBg,
  },
  inputError: { borderColor: colors.red },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  err: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  submitErr: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.placeholder },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 3,
    end: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  checkLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.heading, flexShrink: 1 },
  budget: { marginTop: spacing.sm, gap: 6 },
  budgetTrack: { direction: 'ltr', position: 'relative', height: 8, borderRadius: radius.full, backgroundColor: colors.border },
  budgetZone: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.full, backgroundColor: colors === darkColors ? 'rgba(22,163,74,0.35)' : '#bbf7d0' },
  budgetDot: { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  budgetLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  budgetBuyer: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.muted, flexShrink: 1 },
  budgetFit: { fontFamily: fonts.bold, fontSize: 11.5 },
  budgetWarn: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors === darkColors ? '#fb923c' : '#c2410c',
    backgroundColor: colors === darkColors ? colors.orangeBg : '#fff7ed',
    borderWidth: 1,
    borderColor: colors === darkColors ? 'rgba(249,115,22,0.35)' : '#fed7aa',
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
