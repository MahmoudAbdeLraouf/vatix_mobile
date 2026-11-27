import React, { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { Input } from '@/components/ui/Input'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, spacing, type ThemeColors } from '@/constants/theme'
import { apiFetch, localeName, type Brand, type ProductModel } from '@/lib/api'
import { authPost } from '@/lib/auth'
import { matchesSearch } from '@/lib/search-normalize'

// Mirrors vatix_website/components/product-model-picker.tsx.

export interface ModelPick {
  brandId: string
  brandName: string
  modelId: string
  modelName: string
  notListed: boolean
  variant: string
  /** Brand has no models in this category yet — model becomes optional free text */
  noModels: boolean
  /** null = still loading, false = category has no models (free text) */
  hasCatalog: boolean | null
}

export const EMPTY_PICK: ModelPick = {
  brandId: '', brandName: '', modelId: '', modelName: '', notListed: false, variant: '', noModels: false, hasCatalog: null,
}

/** A category with a catalog needs a brand and a model (listed or typed) */
export function isPickComplete(p: ModelPick) {
  if (!p.hasCatalog) return true
  if (p.noModels) return !!p.brandId
  return !!p.brandId && (!!p.modelId || (p.notListed && p.modelName.trim().length > 0))
}

/** Title suggestion from brand / model / variant */
export function suggestedTitle(p: ModelPick) {
  return [p.brandName, p.modelName.trim(), p.variant.trim()].filter(Boolean).join(' ')
}

/**
 * Product body fields for a pick. A typed model name is sent as a suggestion: an approved one
 * is attached right away, a pending one rides along as suggestedModelId and gets linked when
 * the admin approves it. modelWarning = the suggest call failed (the ad still goes out).
 */
export async function pickToBody(p: ModelPick, categoryId: number) {
  let productModelId: number | null = p.hasCatalog && p.modelId ? Number(p.modelId) : null
  let suggestedModelId: number | null | undefined
  let modelWarning = false
  const typed = p.modelName.trim()
  if (!productModelId && p.brandId && typed && (p.notListed || !p.hasCatalog)) {
    const s = await authPost<{ id: number; status: string }>('/product-models/suggest', {
      categoryId, brandId: Number(p.brandId), name: typed,
    }).catch(() => null)
    if (!s) modelWarning = true
    else if (s.status === 'active') productModelId = s.id
    else if (s.status === 'pending') suggestedModelId = s.id
  }
  return {
    brandId: p.brandId ? Number(p.brandId) : null,
    productModelId,
    ...(suggestedModelId !== undefined && { suggestedModelId }),
    variant: p.variant.trim() || null,
    modelWarning,
  }
}

interface Props {
  categoryId: number | null
  /** All active brands — fallback list and "other brands" */
  brands: Brand[]
  value: ModelPick
  onChange: (patch: Partial<ModelPick>) => void
}

export function ProductModelPicker({ categoryId, brands, value, onChange }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const [catalogBrands, setCatalogBrands] = React.useState<{ id: number; name: string }[]>([])
  const [models, setModels] = React.useState<ProductModel[]>([])
  const [modelsLoading, setModelsLoading] = React.useState(false)

  // Keep the latest value/onChange for async callbacks without re-running the fetch effects
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  })

  const allBrands = useMemo(
    () => brands.map(b => ({ id: b.id, name: localeName(b.translations, locale) })),
    [brands, locale],
  )

  // Category → which brands have models
  useEffect(() => {
    setCatalogBrands([])
    setModels([])
    onChangeRef.current({ hasCatalog: null })
    if (!categoryId) return
    let cancelled = false
    apiFetch<(Brand & { modelCount: number })[]>(`/product-models/brands?categoryId=${categoryId}`)
      .catch(() => [])
      .then(list => {
        if (cancelled) return
        if (!Array.isArray(list) || list.length === 0) {
          onChangeRef.current({ hasCatalog: false })
          return
        }
        const mapped = list.map(b => ({ id: b.id, name: localeName(b.translations, locale) }))
        setCatalogBrands(mapped)
        const found = mapped.find(b => String(b.id) === valueRef.current.brandId)
        onChangeRef.current({ hasCatalog: true, ...(found && { brandName: found.name }) })
      })
    return () => { cancelled = true }
  }, [categoryId, locale])

  // Brand → its models
  useEffect(() => {
    setModels([])
    if (!categoryId || !value.brandId || value.hasCatalog !== true) return
    let cancelled = false
    setModelsLoading(true)
    apiFetch<ProductModel[]>(`/product-models?categoryId=${categoryId}&brandId=${value.brandId}`)
      .catch(() => [])
      .then(list => {
        if (cancelled) return
        const rows = Array.isArray(list) ? list : []
        setModels(rows)
        setModelsLoading(false)
        const cur = valueRef.current
        if (rows.length === 0) {
          onChangeRef.current({ modelId: '', notListed: true, noModels: true })
          return
        }
        if (cur.modelId) {
          const m = rows.find(x => String(x.id) === cur.modelId)
          if (m) onChangeRef.current({ modelName: m.name })
          else onChangeRef.current({ modelId: '', notListed: true }) // model gone — keep the name as typed text
        }
      })
    return () => { cancelled = true; setModelsLoading(false) }
  }, [categoryId, value.brandId, value.hasCatalog])

  // Fill brand name from the full list (no-catalog categories, "other brands", draft/edit prefill)
  useEffect(() => {
    if (value.hasCatalog === null || !value.brandId || value.brandName) return
    const b = allBrands.find(x => String(x.id) === value.brandId)
    if (b) onChange({ brandName: b.name })
  }, [value.hasCatalog, value.brandId, value.brandName, allBrands, onChange])

  const modelOptions = useMemo<SelectOption[]>(
    () => models.map(m => ({ value: String(m.id), label: m.name, keywords: m.aliases ?? undefined })),
    [models],
  )
  const modelMatches = useMemo(() => {
    const byId = new Map(models.map(m => [String(m.id), m]))
    return (q: string, o: SelectOption) => matchesSearch(q, o.label, byId.get(o.value)?.aliases)
  }, [models])

  if (!categoryId) return null

  // Catalog brands first; every other brand stays selectable (its model is typed in)
  const otherBrands = allBrands.filter(b => !catalogBrands.some(c => c.id === b.id))
  const brandList = value.hasCatalog ? [...catalogBrands, ...otherBrands] : allBrands
  const otherLabel = ar ? 'ماركات أخرى' : 'Other brands'
  const brandOptions: SelectOption[] = brandList.map(b => ({
    value: String(b.id),
    label: b.name,
    ...(value.hasCatalog && catalogBrands.length > 0 && !catalogBrands.some(c => c.id === b.id) && { sub: otherLabel }),
  }))

  const pickBrand = (id: string) => {
    const b = brandList.find(x => String(x.id) === id)
    onChange({ brandId: id, brandName: b?.name ?? '', modelId: '', modelName: '', notListed: false, noModels: false })
  }

  const loading = (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color={colors.subtle} />
      <Text style={styles.loadingText}>{ar ? 'جاري التحميل...' : 'Loading...'}</Text>
    </View>
  )

  const variantInput = (
    <Input
      label={ar ? 'السعة / النسخة (اختياري)' : 'Storage / variant (optional)'}
      placeholder={ar ? 'مثال: 256GB' : 'e.g. 256GB'}
      maxLength={100}
      value={value.variant}
      onChangeText={v => onChange({ variant: v })}
      autoCorrect={false}
    />
  )

  if (value.hasCatalog === null) return loading

  // No catalog: optional brand + free-text model
  if (value.hasCatalog === false) {
    return (
      <>
        <SearchableSelect
          label={ar ? 'الماركة (اختياري)' : 'Brand (optional)'}
          placeholder={ar ? 'اختر الماركة' : 'Choose brand'}
          options={brandOptions}
          value={value.brandId}
          onChange={pickBrand}
        />
        {value.brandId ? (
          <Input
            label={ar ? 'الموديل (اختياري)' : 'Model (optional)'}
            maxLength={120}
            value={value.modelName}
            onChangeText={v => onChange({ modelName: v })}
            autoCorrect={false}
          />
        ) : null}
        {variantInput}
      </>
    )
  }

  const modelLabel = value.noModels ? (ar ? 'الموديل (اختياري)' : 'Model (optional)') : (ar ? 'الموديل' : 'Model')

  return (
    <>
      <SearchableSelect
        label={ar ? 'الماركة' : 'Brand'}
        required
        placeholder={ar ? 'اختر الماركة' : 'Choose brand'}
        options={brandOptions}
        value={value.brandId}
        onChange={pickBrand}
      />

      {value.brandId ? (
        modelsLoading ? loading : value.notListed ? (
          <View>
            <Input
              label={modelLabel}
              required={!value.noModels}
              placeholder={ar ? 'اكتب اسم الموديل' : 'Type the model name'}
              maxLength={120}
              value={value.modelName}
              onChangeText={v => onChange({ modelName: v })}
              autoCorrect={false}
            />
            {models.length > 0 ? (
              <Pressable
                onPress={() => onChange({ notListed: false, modelName: '' })}
                hitSlop={8}
                style={styles.backLink}
              >
                <Text style={[styles.backLinkText, { textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr' }]}>
                  {ar ? '← اختر من القائمة' : '← Pick from the list'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <SearchableSelect
            label={modelLabel}
            required
            placeholder={ar ? 'ابحث عن الموديل...' : 'Search model...'}
            options={modelOptions}
            matches={modelMatches}
            value={value.modelId}
            onChange={id => {
              const m = models.find(x => String(x.id) === id)
              onChange({ modelId: id, modelName: m?.name ?? '', notListed: false })
            }}
            footerAction={{
              label: term => term
                ? (ar ? `+ أضف "${term}" كموديل جديد` : `+ Add "${term}" as a new model`)
                : (ar ? '+ الموديل غير موجود' : '+ Model not listed'),
              onPress: term => onChange({ modelId: '', modelName: term, notListed: true }),
            }}
          />
        )
      ) : null}

      {value.brandId ? variantInput : null}
    </>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.subtle,
  },
  backLink: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  backLinkText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: dark ? colors.y : colors.yd,
  },
})
