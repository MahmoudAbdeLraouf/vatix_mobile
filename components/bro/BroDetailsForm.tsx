import React, { useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, fonts, radius } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { submitBroDetails, type BroScratches } from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'

const SCRATCHES: BroScratches[] = ['none', 'minor', 'repaired']

// Mirrors backend BroDetailsDto: >= 0, <= 10,000,000, at most 2 decimals.
const PRICE_FORMAT = /^\d+(\.\d{1,2})?$/
const MAX_PRICE = 10_000_000

/** Arabic keyboards emit Arabic-Indic digits and `٫`/`,` as the decimal mark; the API only takes ASCII. */
function normalizePrice(raw: string): string {
  return raw
    .trim()
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, '.')
}

function isValidPrice(raw: string): boolean {
  const v = normalizePrice(raw)
  if (!PRICE_FORMAT.test(v)) return false
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE
}

/** Seller details form shown inside a Bro chat bubble (step `form`). Port of the website BroDetailsForm. */
export function BroDetailsForm({
  inquiryId,
  disabled,
  onSubmitted,
}: {
  inquiryId: number
  disabled?: boolean
  onSubmitted: () => void
}) {
  const { t, locale } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const [price, setPrice] = useState('')
  const [area, setArea] = useState('')
  const [scratches, setScratches] = useState<BroScratches>('none')
  const [hasBox, setHasBox] = useState(false)
  const [hasInvoice, setHasInvoice] = useState(false)
  const [hasWarranty, setHasWarranty] = useState(false)
  const [warrantyNote, setWarrantyNote] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const locked = busy || !!disabled
  const priceInvalid = price.trim() !== '' && !isValidPrice(price)
  const canSubmit = !locked && isValidPrice(price) && area.trim() !== ''

  const scratchLabel: Record<BroScratches, string> = {
    none: b.scratchesNone,
    minor: b.scratchesMinor,
    repaired: b.scratchesRepaired,
  }

  async function submit() {
    if (locked || inFlight.current) return
    if (!isValidPrice(price)) {
      setError(b.errPrice)
      return
    }
    if (area.trim() === '') return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await submitBroDetails(inquiryId, {
        latestPrice: Number(normalizePrice(price)),
        checkArea: area.trim(),
        scratches,
        hasBox,
        hasInvoice,
        hasWarranty,
        ...(hasWarranty && warrantyNote.trim() ? { warrantyNote: warrantyNote.trim() } : {}),
        ...(note.trim() ? { sellerNote: note.trim() } : {}),
      })
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : b.errGeneric)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.label, dirStyle]}>{b.fieldLatestPrice}</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        editable={!locked}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.g400}
        style={[styles.input, priceInvalid && styles.inputInvalid, dirStyle]}
      />
      {priceInvalid && <Text style={[styles.error, dirStyle]}>{b.errPrice}</Text>}

      <Text style={[styles.label, dirStyle]}>{b.fieldCheckArea}</Text>
      <TextInput
        value={area}
        onChangeText={setArea}
        editable={!locked}
        maxLength={120}
        placeholderTextColor={colors.g400}
        style={[styles.input, dirStyle]}
      />

      <Text style={[styles.label, dirStyle]}>{b.fieldScratches}</Text>
      <View style={[styles.chips, rowDir]}>
        {SCRATCHES.map((s) => (
          <BroButton
            key={s}
            label={scratchLabel[s]}
            variant={scratches === s ? 'dark' : 'outline'}
            selected={scratches === s}
            disabled={locked}
            onPress={() => setScratches(s)}
            dirStyle={dirStyle}
          />
        ))}
      </View>

      <Text style={[styles.label, dirStyle]}>{b.fieldExtras}</Text>
      <View style={[styles.chips, rowDir]}>
        <BroButton
          label={`📦 ${b.extraBox}`}
          variant={hasBox ? 'dark' : 'outline'}
          selected={hasBox}
          disabled={locked}
          onPress={() => setHasBox((v) => !v)}
          dirStyle={dirStyle}
        />
        <BroButton
          label={`🧾 ${b.extraInvoice}`}
          variant={hasInvoice ? 'dark' : 'outline'}
          selected={hasInvoice}
          disabled={locked}
          onPress={() => setHasInvoice((v) => !v)}
          dirStyle={dirStyle}
        />
        <BroButton
          label={`🛡️ ${b.extraWarranty}`}
          variant={hasWarranty ? 'dark' : 'outline'}
          selected={hasWarranty}
          disabled={locked}
          onPress={() => setHasWarranty((v) => !v)}
          dirStyle={dirStyle}
        />
      </View>

      {hasWarranty && (
        <>
          <Text style={[styles.label, dirStyle]}>{b.fieldWarrantyNote}</Text>
          <TextInput
            value={warrantyNote}
            onChangeText={setWarrantyNote}
            editable={!locked}
            maxLength={60}
            placeholderTextColor={colors.g400}
            style={[styles.input, dirStyle]}
          />
        </>
      )}

      <Text style={[styles.label, dirStyle]}>{b.fieldNote}</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        editable={!locked}
        maxLength={280}
        multiline
        placeholderTextColor={colors.g400}
        style={[styles.input, styles.multiline, dirStyle]}
      />

      <View style={[styles.submitRow, rowDir]}>
        <BroButton
          label={busy ? '...' : b.sellerSend}
          variant="dark"
          disabled={!canSubmit}
          onPress={submit}
          dirStyle={dirStyle}
        />
      </View>

      {error && (
        <Text style={[styles.error, dirStyle]} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { marginTop: 10, gap: 6 },
  label: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.g600, marginTop: 4 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
  },
  inputInvalid: { borderColor: colors.red },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  submitRow: { flexDirection: 'row', marginTop: 8 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.red },
})
