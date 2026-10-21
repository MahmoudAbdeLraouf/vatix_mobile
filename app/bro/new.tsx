import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { isLoggedIn } from '@/lib/auth'
import {
  apiFetch,
  getBrands,
  getCategories,
  localeName,
  type Brand,
  type Category,
  type LocationNode,
} from '@/lib/api'
import {
  createBroRequest,
  getBroStatus,
  getModelSuggestions,
  listBroRequests,
  type BroRequestSource,
  type BroWant,
  type CreateBroRequestBody,
} from '@/lib/bro'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { BroButton } from '@/components/bro/BroButton'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const WANTS: BroWant[] = ['cheaper', 'better_condition', 'with_box']
const SOURCES: BroRequestSource[] = ['product', 'product_sold', 'search', 'home', 'nav']
const STORAGE_PRESETS = ['64', '128', '256', '512', '1TB']
const PHONES_NAME = /phone|mobile|هواتف|هاتف|موبايل|محمول/i
const MODEL_MAX = 120
const STORAGE_MAX = 20

type StepKey = 'category' | 'brand' | 'model' | 'storage' | 'area' | 'budget'
type Param = string | string[] | undefined

const first = (v: Param) => (Array.isArray(v) ? v[0] : v)

function parseId(v: Param): number | null {
  const s = first(v)
  if (!s || !/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function parseWants(v: Param): BroWant[] {
  const parts = (first(v) ?? '').split(',')
  return WANTS.filter(w => parts.includes(w))
}

/** Arabic-Indic digits to ASCII, everything else dropped. */
function digitsOnly(v: string): string {
  return v
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .slice(0, 9)
}

interface Options {
  categories: Category[]
  brands: Brand[]
  locations: LocationNode[]
  /** Area of the buyer's latest request, used when the URL carries none. */
  defaultAreaId: number | null
}

/** Feature gate: /bro/new is dark until the backend reports Bro enabled. */
export default function BroNewScreen() {
  const { locale, t } = useLocale()
  const b = t.bro
  const [state, setState] = useState<'loading' | 'error' | 'off' | 'on'>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getBroStatus()
      .then(s => {
        if (!cancelled) setState(s.enabled ? 'on' : 'off')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const retry = () => {
    setState('loading')
    setReloadKey(k => k + 1)
  }

  const dirStyle = { writingDirection: locale === 'ar' ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: b.intakeTitle }} />
      {state === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.y} />
        </View>
      ) : state === 'error' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorState title={b.intakeLoadFailed} retryLabel={b.retry} onRetry={retry} />
        </ScrollView>
      ) : state === 'off' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={[styles.cardTitle, dirStyle]}>{b.unavailableTitle}</Text>
            <Text style={[styles.cardBody, dirStyle]}>{b.unavailableBody}</Text>
            <Button label={b.unavailableHome} variant="dk" size="md" onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </ScrollView>
      ) : (
        <IntakeLoader />
      )}
    </SafeAreaView>
  )
}

/** Loads the pickers' options, then mounts the form so prefill runs once on real data. */
function IntakeLoader() {
  const { t } = useLocale()
  const b = t.bro
  const params = (useLocalSearchParams() as unknown) as Record<string, Param>
  const [options, setOptions] = useState<Options | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cats, brands, locs] = await Promise.all([
          getCategories(),
          getBrands(),
          apiFetch<LocationNode[]>('/locations'),
        ])
        if (!Array.isArray(cats) || !Array.isArray(brands) || !Array.isArray(locs)) throw new Error('bad options')
        const locations = locs.filter(l => l.isActive)
        let defaultAreaId: number | null = null
        if (parseId(params.locationId) == null && (await isLoggedIn())) {
          try {
            const last = (await listBroRequests())?.[0]
            if (last?.locationId != null && locations.some(l => l.id === last.locationId)) {
              defaultAreaId = last.locationId
            }
          } catch {
            // a missing default area is not worth an error
          }
        }
        if (cancelled) return
        setOptions({
          categories: cats.filter(c => c.isActive),
          brands: brands.filter(x => x.isActive),
          locations,
          defaultAreaId,
        })
        setFailed(false)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // params are read once: the form prefills from the URL a single time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  if (failed) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorState
          title={b.intakeLoadFailed}
          retryLabel={b.retry}
          onRetry={() => {
            setFailed(false)
            setReloadKey(k => k + 1)
          }}
        />
      </ScrollView>
    )
  }
  if (!options) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.y} />
      </View>
    )
  }
  return <IntakeForm options={options} params={params} />
}

function IntakeForm({ options, params }: { options: Options; params: Record<string, Param> }) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null
  const { categories, brands, locations } = options

  // One-time prefill from the route params (search / product / login round trip).
  const init = useMemo(() => {
    const categoryId = parseId(params.categoryId)
    const brandId = parseId(params.brandId)
    const locationId = parseId(params.locationId)
    const productId = parseId(params.productId)
    const model = (first(params.model) ?? '').trim().slice(0, MODEL_MAX)
    const storage = (first(params.storage) ?? '').trim().slice(0, STORAGE_MAX)
    const budgetMax = parseId(params.budgetMax)
    const wants = parseWants(params.wants)
    const srcRaw = first(params.source)
    let source: BroRequestSource = SOURCES.find(s => s === srcRaw) ?? 'nav'
    if ((source === 'product' || source === 'product_sold') && productId == null) source = 'nav'
    const catOk = categoryId != null && categories.some(c => c.id === categoryId)
    const brandOk = brandId != null && brands.some(x => x.id === brandId)
    const areaId = locationId != null && locations.some(l => l.id === locationId) ? locationId : options.defaultAreaId
    const known: StepKey[] = []
    if (catOk) known.push('category')
    if (brandOk) known.push('brand')
    if (model.length >= 2) known.push('model')
    if (storage) known.push('storage')
    if (areaId != null && areaId === locationId) known.push('area')
    if (budgetMax != null || wants.length > 0) known.push('budget')
    return {
      categoryId: catOk ? categoryId : null,
      brandId: brandOk ? brandId : null,
      areaId,
      model,
      storage,
      budgetMax,
      wants,
      source,
      productId,
      known,
    }
  }, [params, categories, brands, locations, options.defaultAreaId])

  const [categoryId, setCategoryId] = useState<number | null>(init.categoryId)
  const [brandId, setBrandId] = useState<number | null>(init.brandId)
  const [model, setModel] = useState(init.model)
  const [storage, setStorage] = useState(init.storage)
  const [areaId, setAreaId] = useState(init.areaId != null ? String(init.areaId) : '')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState(init.budgetMax != null ? String(init.budgetMax) : '')
  const [wants, setWants] = useState<BroWant[]>(init.wants)
  const [editing, setEditing] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inFlight = useRef(false)
  const { known } = init

  const showStep = (k: StepKey) => editing || !known.includes(k)
  const catName = useCallback((c: Category) => localeName(c.translations, locale), [locale])
  const brandName = useCallback((x: Brand) => localeName(x.translations, locale), [locale])
  const selectedCategory = categories.find(c => c.id === categoryId) ?? null

  const areaOptions = useMemo(
    () =>
      locations.map(l => ({
        value: String(l.id),
        label: localeName(l.translations, locale),
        sub: l.parentId != null ? localeName(locations.find(p => p.id === l.parentId)?.translations ?? [], locale) : undefined,
      })),
    [locations, locale],
  )

  // Model suggestions: phones only, needs a brand, debounced. Failures just show no chips.
  const wantsSuggestions = !!selectedCategory && PHONES_NAME.test(selectedCategory.translations.map(x => x.name).join(' ')) && brandId != null
  useEffect(() => {
    if (!wantsSuggestions || brandId == null) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      getModelSuggestions(brandId, model.trim())
        .then(items => {
          if (cancelled) return
          const cur = model.trim().toLowerCase()
          setSuggestions((Array.isArray(items) ? items : []).filter(s => s.toLowerCase() !== cur).slice(0, 8))
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [wantsSuggestions, brandId, model])

  const modelTrim = model.trim()
  const minN = budgetMin ? Number(budgetMin) : null
  const maxN = budgetMax ? Number(budgetMax) : null
  const errCategory = categoryId == null
  const errModel = modelTrim.length < 2 || modelTrim.length > MODEL_MAX
  const errArea = !areaId
  const errBudget = minN != null && maxN != null && minN > maxN

  const toggleWant = (w: BroWant) => setWants(cur => (cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w]))
  const wantLabel: Record<BroWant, string> = {
    cheaper: b.wantCheaper,
    better_condition: b.wantBetterCondition,
    with_box: b.wantWithBox,
  }

  const summaryParts = [
    selectedCategory ? catName(selectedCategory) : null,
    brands.find(x => x.id === brandId) ? brandName(brands.find(x => x.id === brandId)!) : null,
    modelTrim || null,
    storage || null,
    areaOptions.find(o => o.value === areaId)?.label ?? null,
    maxN ? `${b.budgetMax} ${b.priceEgp.replace('{price}', maxN.toLocaleString())}` : null,
    ...wants.map(w => wantLabel[w]),
  ].filter(Boolean)

  function friendlyError(e: unknown): string {
    const msg = e instanceof Error ? e.message : ''
    return !msg || msg === 'خطأ في الخادم' ? b.errGeneric : msg
  }

  async function submit() {
    if (inFlight.current) return
    setShowErrors(true)
    if (errCategory || errModel || errArea || errBudget) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    let navigating = false
    try {
      // Logged out: carry the draft through login in the redirect URL.
      if (!(await isLoggedIn())) {
        const draft = new URLSearchParams({ source: init.source })
        if (init.productId != null) draft.set('productId', String(init.productId))
        draft.set('categoryId', String(categoryId))
        if (brandId != null) draft.set('brandId', String(brandId))
        draft.set('locationId', areaId)
        draft.set('model', modelTrim)
        if (storage.trim()) draft.set('storage', storage.trim())
        if (maxN) draft.set('budgetMax', String(maxN))
        if (wants.length) draft.set('wants', wants.join(','))
        router.push({ pathname: '/(auth)/login', params: { redirect: `/bro/new?${draft.toString()}` } })
        return
      }
      const body: CreateBroRequestBody = {
        categoryId: categoryId as number,
        modelText: modelTrim,
        locationId: Number(areaId),
        source: init.source,
      }
      if (brandId != null) body.brandId = brandId
      if (storage.trim()) body.storage = storage.trim()
      if (minN) body.budgetMin = minN
      if (maxN) body.budgetMax = maxN
      if (wants.length) body.wants = wants
      if (init.productId != null) body.sourceProductId = init.productId
      const res = await createBroRequest(body)
      navigating = true
      router.replace(`/bro/requests/${res.request.id}` as never)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      inFlight.current = false
      if (!navigating) setBusy(false)
    }
  }

  const tag = (req: boolean) => (
    <Text style={[styles.tag, req ? styles.tagReq : null]}>{req ? b.required : b.optional}</Text>
  )
  const label = (text: string, req: boolean) => (
    <View style={[styles.labelRow, rowDir]}>
      <Text style={[styles.label, dirStyle]}>{text}</Text>
      {tag(req)}
    </View>
  )
  const fieldError = (msg: string) => (showErrors ? <Text style={[styles.err, dirStyle]}>{msg}</Text> : null)

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={[styles.header, rowDir]}>
        <BroAvatar size={32} />
        <Text style={[styles.title, dirStyle]}>{b.intakeTitle}</Text>
      </View>

      <View style={styles.card}>
        {known.length > 0 && !editing ? (
          <View style={styles.summary}>
            <Text style={[styles.summaryLabel, dirStyle]}>{b.knownFromSearch}</Text>
            <Text style={[styles.summaryText, dirStyle]}>{summaryParts.join(' · ')}</Text>
            <View style={styles.summaryEdit}>
              <BroButton label={b.edit} onPress={() => setEditing(true)} dirStyle={dirStyle} />
            </View>
          </View>
        ) : null}

        {showStep('category') ? (
          <View style={styles.field}>
            {label(b.stepCategory, true)}
            <View style={[styles.chips, rowDir]}>
              {categories.map(c => (
                <BroButton
                  key={c.id}
                  label={catName(c)}
                  selected={categoryId === c.id}
                  variant={categoryId === c.id ? 'dark' : 'outline'}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>
            {errCategory ? fieldError(b.errCategoryRequired) : null}
          </View>
        ) : null}

        {showStep('brand') ? (
          <View style={styles.field}>
            {label(b.stepBrand, false)}
            <ScrollView style={styles.brandScroll} nestedScrollEnabled>
              <View style={[styles.chips, rowDir]}>
                {brands.map(x => (
                  <BroButton
                    key={x.id}
                    label={brandName(x)}
                    selected={brandId === x.id}
                    variant={brandId === x.id ? 'dark' : 'outline'}
                    onPress={() => setBrandId(cur => (cur === x.id ? null : x.id))}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {showStep('model') ? (
          <View style={styles.field}>
            {label(b.stepModel, true)}
            <TextInput
              value={model}
              onChangeText={v => setModel(v.slice(0, MODEL_MAX))}
              placeholder={b.modelPlaceholder}
              placeholderTextColor={colors.g400}
              maxLength={MODEL_MAX}
              style={[styles.input, dirStyle]}
            />
            {suggestions.length > 0 ? (
              <View style={[styles.chips, rowDir]}>
                {suggestions.map(s => (
                  <BroButton key={s} label={s} onPress={() => setModel(s.slice(0, MODEL_MAX))} dirStyle={dirStyle} />
                ))}
              </View>
            ) : null}
            {errModel ? fieldError(b.errModelRequired) : null}
          </View>
        ) : null}

        {showStep('storage') ? (
          <View style={styles.field}>
            {label(b.stepStorage, false)}
            <TextInput
              value={storage}
              onChangeText={v => setStorage(v.slice(0, STORAGE_MAX))}
              placeholder={b.storagePlaceholder}
              placeholderTextColor={colors.g400}
              maxLength={STORAGE_MAX}
              style={[styles.input, dirStyle]}
            />
            <View style={[styles.chips, rowDir]}>
              {STORAGE_PRESETS.map(p => (
                <BroButton
                  key={p}
                  label={p}
                  selected={storage === p}
                  variant={storage === p ? 'dark' : 'outline'}
                  onPress={() => setStorage(cur => (cur === p ? '' : p))}
                />
              ))}
            </View>
          </View>
        ) : null}

        {showStep('area') ? (
          <View style={styles.field}>
            {label(b.stepArea, true)}
            <SearchableSelect options={areaOptions} value={areaId} onChange={setAreaId} placeholder={b.areaPlaceholder} />
            {errArea ? fieldError(b.errAreaRequired) : null}
          </View>
        ) : null}

        {showStep('budget') ? (
          <View style={styles.field}>
            {label(b.stepBudget, false)}
            <View style={[styles.budgetRow, rowDir]}>
              <TextInput
                value={budgetMin}
                onChangeText={v => setBudgetMin(digitsOnly(v))}
                placeholder={b.budgetMin}
                placeholderTextColor={colors.g400}
                keyboardType="number-pad"
                style={[styles.input, styles.budgetInput, dirStyle]}
              />
              <TextInput
                value={budgetMax}
                onChangeText={v => setBudgetMax(digitsOnly(v))}
                placeholder={b.budgetMax}
                placeholderTextColor={colors.g400}
                keyboardType="number-pad"
                style={[styles.input, styles.budgetInput, dirStyle]}
              />
            </View>
            {errBudget ? fieldError(b.errBudgetRange) : null}
            <Text style={[styles.sub, dirStyle]}>{b.wantsLabel}</Text>
            <View style={[styles.chips, rowDir]}>
              {WANTS.map(w => (
                <BroButton
                  key={w}
                  label={wantLabel[w]}
                  selected={wants.includes(w)}
                  variant={wants.includes(w) ? 'dark' : 'outline'}
                  onPress={() => toggleWant(w)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {error ? <Text style={[styles.errBox, dirStyle]}>{error}</Text> : null}

        <Button label={busy ? b.submitting : b.submit} variant="dk" size="lg" fullWidth loading={busy} onPress={submit} />
        <Text style={[styles.footer, dirStyle]}>{b.intakeFooter}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.extraBold, fontSize: 18, color: '#1A2540' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.ss,
  },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: '#1A2540' },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.g700, lineHeight: 22 },
  summary: {
    backgroundColor: '#fff8e1',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.y,
    padding: spacing.sm + 4,
    gap: 4,
  },
  summaryLabel: { fontFamily: fonts.bold, fontSize: 12, color: '#8a6500' },
  summaryText: { fontFamily: fonts.semiBold, fontSize: 14, color: '#1A2540' },
  summaryEdit: { alignSelf: 'flex-start', marginTop: 4 },
  field: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.bold, fontSize: 14, color: '#1A2540' },
  tag: { fontFamily: fonts.regular, fontSize: 11, color: colors.g500 },
  tagReq: { color: colors.red },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  brandScroll: { maxHeight: 148 },
  input: {
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
    backgroundColor: colors.white,
  },
  budgetRow: { flexDirection: 'row', gap: spacing.sm },
  budgetInput: { flex: 1 },
  sub: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.g700, marginTop: 4 },
  err: { fontFamily: fonts.regular, fontSize: 12, color: colors.red },
  errBox: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.red },
  footer: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500 },
})
