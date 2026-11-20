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
/** Green zone = the buyer's budget, knob = the seller's price. */
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
          <View style={[styles.budgetKnob, start(price), ar ? { marginRight: -10 } : { marginLeft: -10 }]} />
        ) : null}
      </View>
      <View style={[styles.budgetLabels, rowDir]}>
        <Text style={[styles.budgetBuyer, dirStyle]}>{b.budgetBarBuyer}: {amount} {b.budgetCurrency}</Text>
        {fit ? (
          <Text style={styles.budgetBuyer}>
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
  notice,
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
  /** Blue info box above the fields (e.g. "prefilled from the request"). */
  notice?: string
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
  const hasBudget = budget?.max != null && budget.max > 0
  const fit = budgetFitOf(priceOk ? priceNum : 0, budget?.max)
  const full = images.length >= MAX_PHOTOS

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
      {notice ? <Text style={[styles.notice, dirStyle]}>{notice}</Text> : null}

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

      <View style={styles.priceBox}>
        <View style={[styles.priceRow, rowDir]}>
          <Text style={[styles.priceLabel, dirStyle]}>{hasBudget ? b.priceYourOffer : b.offerPriceLabel}</Text>
          <View style={[styles.priceRight, rowDir]}>
            {fit ? (
              <Text style={[styles.fitTag, { color: fit === 'over' ? FIT_OVER : FIT_IN }]}>
                {fit === 'over' ? b.overBudgetTag : b.inBudgetTag}
              </Text>
            ) : null}
            <TextInput
              value={price}
              onChangeText={v => setPrice(v.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.subtle}
              editable={!locked}
              style={[styles.priceInput, inputDir, showErrors && !priceOk && styles.inputError]}
            />
          </View>
        </View>
        {showErrors && !priceOk ? <Text style={[styles.err, dirStyle]}>{b.errOfferPrice}</Text> : null}
        {hasBudget ? <BudgetBar price={priceOk ? priceNum : 0} min={budget!.min} max={budget!.max!} /> : null}
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
                  style={[styles.thumbRemove, ar ? { left: -6 } : { right: -6 }]}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={12} color={colors.white} />
                </Pressable>
              </View>
            )
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={b.addPhotos}
            disabled={locked || full}
            onPress={addPhotos}
            style={[styles.addTile, uploading && styles.addTileBusy, full && styles.addTileFull]}
          >
            <Text style={uploading ? styles.addTileBusyText : styles.addTilePlus}>{uploading ? b.uploadingPhotos : '+'}</Text>
          </Pressable>
        </View>
        {uploadError ? <Text style={[styles.err, dirStyle]}>{b.photosUploadFailed}</Text> : null}
      </View>

      {showSave || showSaveProduct ? (
        <View style={styles.after}>
          <Text style={[styles.afterLabel, dirStyle]}>{b.afterSend}</Text>
          {showSaveProduct ? (
            <ToggleRow highlight title={b.saveAsProductTitle} sub={b.saveAsProductSub} on={saveProduct} disabled={locked} onToggle={() => setSaveProduct(v => !v)} />
          ) : null}
          {showSave ? (
            <ToggleRow title={b.saveOfferTitle} sub={b.saveOfferSub} on={save} disabled={locked} onToggle={() => setSave(v => !v)} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.submitBox}>
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
    </View>
  )
}

function ToggleRow({
  title,
  sub,
  on,
  highlight,
  disabled,
  onToggle,
}: {
  title: string
  sub: string
  on: boolean
  highlight?: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  const { ar, dirStyle, rowDir } = useBroDir()
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onToggle}
      style={[styles.toggleRow, highlight && styles.toggleRowHi, rowDir]}
    >
      <View style={styles.toggleText}>
        <Text style={[styles.toggleTitle, dirStyle]}>{title}</Text>
        <Text style={[styles.toggleSub, dirStyle]}>{sub}</Text>
      </View>
      {/* Track pinned to ltr; "on" sits at the reading end. */}
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.switchKnob, on === ar ? { left: 3 } : { left: 19 }]} />
      </View>
    </Pressable>
  )
}

const FIT_IN = '#0b7a52'
const FIT_OVER = '#b45309'

const makeStyles = (colors: ThemeColors) => {
  const dark = colors === darkColors
  return StyleSheet.create({
    wrap: { gap: 12 },
    field: { gap: 6 },
    label: { fontFamily: fonts.black, fontSize: 12, color: colors.muted },
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
    textarea: { minHeight: 72, textAlignVertical: 'top' },
    err: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
    submitErr: { fontSize: 13 },
    notice: {
      fontFamily: fonts.bold,
      fontSize: 12.5,
      color: dark ? '#9db8ff' : '#2952cc',
      backgroundColor: dark ? colors.blueBg : '#f5f8ff',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      overflow: 'hidden',
    },
    priceBox: { backgroundColor: colors.placeholder, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
    priceLabel: { fontFamily: fonts.black, fontSize: 13, color: dark ? colors.text : colors.g700, flexShrink: 1 },
    priceRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fitTag: { fontFamily: fonts.black, fontSize: 12 },
    priceInput: {
      width: 150,
      backgroundColor: colors.inputBg,
      borderWidth: 1.5,
      borderColor: dark ? colors.border : colors.g300,
      borderRadius: 10,
      paddingVertical: 5,
      paddingHorizontal: 12,
      fontFamily: fonts.black,
      fontSize: 17,
      color: colors.heading,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    photos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 6, direction: 'ltr' },
    thumb: { width: 56, height: 56 },
    thumbImg: {
      width: 56,
      height: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.placeholder,
    },
    thumbRemove: {
      position: 'absolute',
      top: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: dark ? colors.dk3 : colors.dk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
      minWidth: 56,
      height: 56,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: dark ? colors.border : colors.g300,
      backgroundColor: colors.placeholder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTileBusy: { paddingHorizontal: 8 },
    addTileFull: { opacity: 0.5 },
    addTilePlus: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.muted, lineHeight: 28 },
    addTileBusyText: { fontFamily: fonts.extraBold, fontSize: 11, color: colors.muted },
    after: {
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: dark ? colors.border : colors.g300,
      paddingTop: 12,
      gap: 10,
    },
    afterLabel: { fontFamily: fonts.black, fontSize: 12, color: colors.muted },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: colors.placeholder,
    },
    toggleRowHi: {
      backgroundColor: dark ? colors.blueBg : '#f5f8ff',
      borderColor: dark ? 'rgba(59,130,246,0.35)' : '#d5e0fb',
    },
    toggleText: { flex: 1, gap: 2 },
    toggleTitle: { fontFamily: fonts.black, fontSize: 13.5, color: colors.heading },
    toggleSub: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
    switch: {
      direction: 'ltr',
      width: 40,
      height: 24,
      borderRadius: 12,
      backgroundColor: dark ? colors.border : colors.g300,
    },
    switchOn: { backgroundColor: colors.green },
    switchKnob: { position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white },
    submitBox: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2, paddingTop: 12, gap: 8 },
    budget: { gap: 4 },
    budgetTrack: {
      direction: 'ltr',
      position: 'relative',
      height: 10,
      borderRadius: 9,
      marginTop: 12,
      marginBottom: 4,
      backgroundColor: dark ? colors.border : colors.g200,
    },
    budgetZone: { position: 'absolute', top: 0, bottom: 0, borderRadius: 9, backgroundColor: dark ? 'rgba(18,184,134,0.45)' : '#9de2c4' },
    budgetKnob: {
      position: 'absolute',
      top: -5,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 3,
      borderColor: colors.white,
      backgroundColor: dark ? colors.y : colors.dk,
    },
    budgetLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    budgetBuyer: { fontFamily: fonts.extraBold, fontSize: 11, color: colors.subtle, flexShrink: 1 },
    budgetWarn: {
      marginTop: 6,
      fontFamily: fonts.bold,
      fontSize: 12,
      color: dark ? '#fb923c' : '#b45309',
      backgroundColor: dark ? colors.orangeBg : '#fff7ed',
      borderWidth: 1,
      borderColor: dark ? 'rgba(249,115,22,0.35)' : '#fed7aa',
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      overflow: 'hidden',
    },
  })
}

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
