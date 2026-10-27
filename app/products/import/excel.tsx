import React, { useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as XLSX from 'xlsx'
import { DashboardLayout } from '@/components/DashboardLayout'
import { BottomTabBar } from '@/components/BottomTabBar'
import { Button } from '@/components/ui/Button'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { ImportBackLink } from '@/components/import/ImportBackLink'
import { ClientCapCard } from '@/components/import/ClientCapCard'
import { DefaultCategoryBrand } from '@/components/import/DefaultCategoryBrand'
import { ImportRowCard } from '@/components/import/ImportRowCard'
import { ImportErrors } from '@/components/import/ImportErrors'
import { useImportOptions } from '@/hooks/useImportOptions'
import { describeImportError, useImportConfirm } from '@/hooks/useImportConfirm'
import { useLocale } from '@/contexts/locale'
import {
  EMPTY_MAPPING,
  INTERNAL_FIELDS,
  autoMapHeaders,
  buildNormalizedCsv,
  confirmCsv,
  csvCellEscape,
  parseCsvRows,
  previewCsv,
  type CsvRow,
  type ImportPreviewError,
  type InternalField,
} from '@/lib/import'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const TEMPLATE_URL = 'https://vatix.store/csv-templates/products-import-template.csv'
const PICK_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Lets legacy .xls show up so we can explain why it's rejected; some Android
  // file providers also report .csv with this type.
  'application/vnd.ms-excel',
]

// expo-document-picker is a native module; builds made before it was added
// don't have it, so load it lazily and fall back to expo-file-system's picker
// (File.pickFileAsync), which those builds already ship.
let DocumentPicker: typeof import('expo-document-picker') | null = null
try {
  DocumentPicker = require('expo-document-picker')
} catch {
  DocumentPicker = null
}

class SheetError extends Error {}

type PickedSheet = { file: File; name: string }

async function pickSheet(): Promise<PickedSheet | null> {
  if (DocumentPicker) {
    const result = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES, copyToCacheDirectory: true })
    if (result.canceled || !result.assets?.[0]) return null
    const asset = result.assets[0]
    return { file: new File(asset.uri), name: asset.name ?? '' }
  }
  try {
    const result = await File.pickFileAsync()
    const first = Array.isArray(result) ? result[0] : result
    if (!first) return null
    const picked = new File(first.uri)
    // Android content URIs often carry an encoded document id rather than a filename.
    let name = picked.name
    try {
      name = decodeURIComponent(name)
    } catch {}
    return { file: picked, name: name.split(/[/:]/).pop() ?? '' }
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (/cancel/i.test(`${e?.code ?? ''} ${e?.message ?? ''}`)) return null
    throw err
  }
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b)

// Excel sheets are converted to CSV text on the device so the mapping/preview
// flow stays CSV-only, same as the website's readSheetAsCsvText. The format is
// sniffed from the bytes because the fallback picker can't always give a filename.
async function readSheetAsCsvText(file: File, ip: { excelXlsUnsupported: string; excelUnsupported: string }): Promise<string> {
  const bytes = await file.bytes()
  // Legacy .xls (OLE2 compound file).
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) throw new SheetError(ip.excelXlsUnsupported)
  // .xlsx is a ZIP archive; anything else must be plain CSV text.
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (bytes.subarray(0, 4096).includes(0)) throw new SheetError(ip.excelUnsupported)
    return file.text()
  }
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return ''
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
  return rows
    .map((row) =>
      row
        .map((v) => {
          if (v === null || v === undefined) return ''
          if (v instanceof Date) return v.toISOString().slice(0, 10)
          return csvCellEscape(String(v))
        })
        .join(','),
    )
    .join('\n')
}

// Excel / CSV import — mirrors the website's CsvImportTab
// (vatix_website/app/dashboard/products/import/page.tsx).
export default function ExcelImportScreen() {
  const { t, locale } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    // Pin the Text's own direction so 'right' isn't double-flipped by the inherited RTL root.
    direction: 'ltr' as const,
  }
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  const { categoryOptions, brandOptions } = useImportOptions()
  const confirm = useImportConfirm('excel')

  const [fileName, setFileName] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<InternalField, string | null>>({ ...EMPTY_MAPPING })
  const [picking, setPicking] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const [defaultCategory, setDefaultCategory] = useState('')
  const [defaultBrand, setDefaultBrand] = useState('')

  const [rows, setRows] = useState<CsvRow[] | null>(null)
  const [previewErrors, setPreviewErrors] = useState<ImportPreviewError[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const resetPreview = () => {
    setRows(null)
    setPreviewErrors([])
    setPreviewError(null)
    confirm.setError(null)
  }

  const onPickFile = async () => {
    setPicking(true)
    setFileError(null)
    try {
      const picked = await pickSheet()
      if (!picked) return
      const { file, name } = picked

      let text: string
      try {
        text = await readSheetAsCsvText(file, ip)
      } catch (err) {
        throw err instanceof SheetError ? err : new SheetError(ip.excelReadFailed)
      }
      // Drop a UTF-8 BOM so the first header still auto-maps.
      text = text.replace(/^\uFEFF/, '')
      const parsed = parseCsvRows(text)
      if (parsed.length === 0) throw new SheetError(ip.excelEmpty)

      const found = parsed[0].map((h) => h.trim()).filter((h) => h.length > 0)
      resetPreview()
      setFileName(name)
      setSourceText(text)
      setHeaders(found)
      setMapping(autoMapHeaders(found))
    } catch (err) {
      setFileError(err instanceof SheetError ? err.message : ip.excelReadFailed)
    } finally {
      setPicking(false)
    }
  }

  const onMappingChange = (field: InternalField, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value || null }))
    resetPreview()
  }

  const canPreview = !!mapping.title && !!mapping.price && !loadingPreview

  const onPreview = async () => {
    if (!canPreview) return
    setLoadingPreview(true)
    resetPreview()
    try {
      const csv = buildNormalizedCsv(sourceText, mapping)
      const file = new File(Paths.cache, 'import.csv')
      file.create({ overwrite: true })
      file.write(csv)
      const res = await previewCsv(file.uri)
      const defCat = defaultCategory ? Number(defaultCategory) : null
      const defBrand = defaultBrand ? Number(defaultBrand) : null
      setRows(
        res.valid.map((r) => ({
          ...r,
          images: Array.isArray(r.images) ? r.images : [],
          categoryId: r.categoryId ?? defCat,
          brandId: r.brandId ?? defBrand,
        })),
      )
      setPreviewErrors(res.errors)
    } catch (err) {
      setPreviewError(describeImportError(err, t, ip.loadFailed))
    } finally {
      setLoadingPreview(false)
    }
  }

  // Website behaviour: picking a default overwrites every row; clearing leaves rows as they are.
  const onDefaultCategory = (v: string) => {
    setDefaultCategory(v)
    if (v) setRows((prev) => prev?.map((r) => ({ ...r, categoryId: Number(v) })) ?? prev)
  }
  const onDefaultBrand = (v: string) => {
    setDefaultBrand(v)
    if (v) setRows((prev) => prev?.map((r) => ({ ...r, brandId: Number(v) })) ?? prev)
  }

  const updateRow = (rowNumber: number, patch: Partial<CsvRow>) =>
    setRows((prev) => prev?.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)) ?? prev)
  const removeRow = (rowNumber: number) =>
    setRows((prev) => prev?.filter((r) => r.rowNumber !== rowNumber) ?? prev)

  const columnOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: ip.mapNone }, ...headers.map((h) => ({ value: h, label: h }))],
    [headers, ip.mapNone],
  )
  const fieldLabels: Record<InternalField, string> = {
    title: `${ip.mapTitle} *`,
    description: ip.mapDescription,
    price: `${ip.mapPrice} *`,
    images: ip.mapImages,
  }

  const hasErrors = previewErrors.length > 0
  const missingCategory = rows?.some((r) => r.categoryId == null) ?? false
  const missingBrand = rows?.some((r) => r.brandId == null) ?? false
  const rowCount = rows?.length ?? 0
  const canConfirm = !confirm.busy && rowCount > 0 && !hasErrors && !missingCategory && !missingBrand

  const onConfirm = () => {
    if (!rows || !canConfirm) return
    confirm.run(() =>
      confirmCsv(
        rows.map((r) => ({
          title: r.title,
          description: r.description,
          price: r.price,
          categoryId: r.categoryId as number,
          brandId: r.brandId as number,
          images: r.images,
          rowNumber: r.rowNumber,
        })),
      ),
    )
  }

  return (
    <DashboardLayout title={ip.excelTitle} scroll={false} contentPadding={false} bottomBar={<BottomTabBar />}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImportBackLink />
        <ClientCapCard screen="excel" />
        <Text style={[styles.title, dirStyle]}>{ip.excelTitle}</Text>

        <View style={styles.card}>
          <Text style={[styles.muted, dirStyle]}>{ip.excelSubtitle}</Text>

          {fileName ? (
            <View style={[styles.fileRow, rowDir]}>
              <Text style={styles.fileName} numberOfLines={1}>
                📄 {fileName}
              </Text>
            </View>
          ) : null}

          <Button
            label={fileName ? ip.excelChangeFile : ip.excelPickBtn}
            variant={fileName ? 'outline' : 'dk'}
            fullWidth
            loading={picking}
            disabled={picking}
            onPress={onPickFile}
          />

          {fileError ? <Text style={[styles.errorText, dirStyle]}>{fileError}</Text> : null}

          <Pressable onPress={() => Linking.openURL(TEMPLATE_URL)} hitSlop={6} accessibilityRole="link">
            <Text style={[styles.link, dirStyle]}>{ip.excelTemplate}</Text>
          </Pressable>
          <Text style={[styles.muted, dirStyle]}>{ip.excelTemplateHint}</Text>
        </View>

        {fileName ? (
          <View style={styles.card}>
            <Text style={[styles.heading, dirStyle]}>{ip.mapHeading}</Text>
            {INTERNAL_FIELDS.map((field) => (
              <SearchableSelect
                key={field}
                label={fieldLabels[field]}
                options={columnOptions}
                value={mapping[field] ?? ''}
                onChange={(v) => onMappingChange(field, v)}
                placeholder={ip.mapPlaceholder}
              />
            ))}
            {!mapping.title || !mapping.price ? (
              <Text style={[styles.hint, dirStyle]}>{ip.mapRequiredHint}</Text>
            ) : null}
            <Button
              label={ip.previewBtn}
              variant={rows === null ? 'dk' : 'outline'}
              fullWidth
              loading={loadingPreview}
              disabled={!canPreview}
              onPress={onPreview}
              style={!canPreview && !loadingPreview ? styles.disabled : undefined}
            />
            {previewError ? <Text style={[styles.errorText, dirStyle]}>{previewError}</Text> : null}
          </View>
        ) : null}

        {rows !== null ? (
          <>
            <DefaultCategoryBrand
              categoryOptions={categoryOptions}
              brandOptions={brandOptions}
              category={defaultCategory}
              brand={defaultBrand}
              onCategoryChange={onDefaultCategory}
              onBrandChange={onDefaultBrand}
            />

            <Text style={[styles.heading, dirStyle]}>
              {rowCount > 0 ? ip.rowsCount.replace('{count}', String(rowCount)) : ip.noRows}
            </Text>

            {rows.map((r) => (
              <ImportRowCard
                key={r.rowNumber}
                rowNumber={r.rowNumber}
                title={r.title}
                price={r.price}
                images={r.images}
                categoryId={r.categoryId}
                brandId={r.brandId}
                categoryOptions={categoryOptions}
                brandOptions={brandOptions}
                onCategoryChange={(id) => updateRow(r.rowNumber, { categoryId: id })}
                onBrandChange={(id) => updateRow(r.rowNumber, { brandId: id })}
                onRemove={() => removeRow(r.rowNumber)}
              />
            ))}

            <ImportErrors errors={previewErrors} />

            {hasErrors ? (
              <Text style={[styles.hint, dirStyle]}>{ip.fixErrors}</Text>
            ) : rowCount > 0 && missingCategory ? (
              <Text style={[styles.hint, dirStyle]}>{ip.pickCategoryForEachRow}</Text>
            ) : rowCount > 0 && missingBrand ? (
              <Text style={[styles.hint, dirStyle]}>{ip.pickBrandForEachRow}</Text>
            ) : null}

            {confirm.error ? <Text style={[styles.errorText, dirStyle]}>{confirm.error}</Text> : null}

            <Button
              label={confirm.busy ? ip.saving : ip.confirmBtn.replace('{count}', String(rowCount))}
              variant="cta"
              fullWidth
              loading={confirm.busy}
              disabled={!canConfirm}
              onPress={onConfirm}
              style={!canConfirm && !confirm.busy ? styles.disabled : undefined}
            />
          </>
        ) : null}
      </ScrollView>
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.heading },
  card: {
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...(dark ? null : shadow.ss),
  },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.heading },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.placeholder,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  fileName: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  link: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.heading, textDecorationLine: 'underline' },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  hint: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  errorText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  disabled: { opacity: 0.5 },
})
