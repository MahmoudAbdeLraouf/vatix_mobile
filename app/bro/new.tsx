import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { broHeader } from '@/components/bro/BroStackHeader'
import { Ionicons } from '@expo/vector-icons'
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
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const WANTS: BroWant[] = ['cheaper', 'better_condition', 'with_box']
const SOURCES: BroRequestSource[] = ['product', 'product_sold', 'search', 'home', 'nav']
const STORAGE_PRESETS = ['64', '128', '256', '512', '1TB']
const PHONES_NAME = /phone|mobile|هواتف|هاتف|موبايل|محمول/i
const MODEL_MAX = 120
const STORAGE_MAX = 20

type StepKey = 'category' | 'brand' | 'model' | 'storage' | 'area' | 'budget'
type Param = string | string[] | undefined
type IconName = React.ComponentProps<typeof Ionicons>['name']

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
  const { colors } = useTheme()
  const styles = useStyles()
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
      <Stack.Screen options={broHeader(b.intakeTitle)} />
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
  const { colors } = useTheme()
  const styles = useStyles()
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
  // Text inside a rowDir row inherits direction:'ltr', so textAlign:'auto' would
  // pin Arabic left — align physically instead.
  const rowText = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: ar ? ('right' as const) : ('left' as const) }
  const { categories, brands, locations } = options
  const { colors } = useTheme()
  const styles = useStyles()

  // One-time prefill from the route params (search / product / login round trip).
  const init = useMemo(() => {
    const categoryId = parseId(params.categoryId)
    const brandId = parseId(params.brandId)
    const locationId = parseId(params.locationId)
    const productId = parseId(params.productId)
    const model = (first(params.model) ?? '').trim().slice(0, MODEL_MAX)
    const storage = (first(params.storage) ?? '').trim().slice(0, STORAGE_MAX)
    const budgetMin = parseId(params.budgetMin)
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
    if (budgetMin != null || budgetMax != null || wants.length > 0) known.push('budget')
    return {
      categoryId: catOk ? categoryId : null,
      brandId: brandOk ? brandId : null,
      areaId,
      model,
      storage,
      budgetMin,
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
  const [budgetMin, setBudgetMin] = useState(init.budgetMin != null ? String(init.budgetMin) : '')
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
        if (minN) draft.set('budgetMin', String(minN))
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

  const catOptions = useMemo(() => categories.map(c => ({ value: String(c.id), label: catName(c) })), [categories, catName])
  const brandOptions = useMemo(() => brands.map(x => ({ value: String(x.id), label: brandName(x) })), [brands, brandName])

  // Required is the default; only optional fields are tagged.
  const label = (text: string, req: boolean) => (
    <View style={[styles.labelRow, rowDir]}>
      <Text style={[styles.label, rowText]}>{text}</Text>
      {req ? null : (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{b.optional}</Text>
        </View>
      )}
    </View>
  )
  const fieldError = (msg: string) => (showErrors ? <Text style={[styles.err, dirStyle]}>{msg}</Text> : null)
  const section = (icon: IconName, title: string) => (
    <View style={[styles.sectionHead, rowDir]}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={17} color={colors.yellowText} />
      </View>
      <Text style={[styles.sectionTitle, rowText]}>{title}</Text>
    </View>
  )
  const pill = (key: string, text: string, on: boolean, onPress: () => void, icon?: IconName) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.pill, rowDir, on && styles.pillOn, pressed && !on && styles.pillPressed]}
    >
      {icon ? <Ionicons name={icon} size={14} color={on ? colors.yellowText : colors.muted} /> : null}
      <Text style={[styles.pillText, on && styles.pillTextOn]}>{text}</Text>
    </Pressable>
  )

  const showDevice = showStep('category') || showStep('brand') || showStep('model') || showStep('storage')
  const showWhere = showStep('area') || showStep('budget')

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={[styles.hero, rowDir]}>
          <View style={styles.heroGlow} />
          <View style={styles.heroAvatar}>
            <BroAvatar size={46} radius={23} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, rowText]}>{b.intakeHeroTitle}</Text>
            <Text style={[styles.heroHint, rowText]}>{b.intakeHint}</Text>
          </View>
        </View>

        {known.length > 0 && !editing ? (
          <View style={styles.summary}>
            <View style={[styles.summaryHead, rowDir]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.yellowText} />
              <Text style={[styles.summaryLabel, rowText]}>{b.knownFromSearch}</Text>
              <Pressable onPress={() => setEditing(true)} hitSlop={8} style={({ pressed }) => [styles.editBtn, rowDir, pressed && styles.pillPressed]}>
                <Ionicons name="create-outline" size={14} color={colors.heading} />
                <Text style={styles.editText}>{b.edit}</Text>
              </Pressable>
            </View>
            <Text style={[styles.summaryText, dirStyle]}>{summaryParts.join(' · ')}</Text>
          </View>
        ) : null}

        {showDevice ? (
          <View style={styles.card}>
            {section('phone-portrait-outline', b.sectionDevice)}

            {showStep('category') ? (
              <View style={styles.field}>
                {label(b.stepCategory, true)}
                <SearchableSelect
                  options={catOptions}
                  value={categoryId != null ? String(categoryId) : ''}
                  onChange={v => setCategoryId(v ? Number(v) : null)}
                  placeholder={b.categoryPlaceholder}
                  style={styles.select}
                />
                {errCategory ? fieldError(b.errCategoryRequired) : null}
              </View>
            ) : null}

            {showStep('brand') ? (
              <View style={styles.field}>
                {label(b.stepBrand, false)}
                <SearchableSelect
                  options={brandOptions}
                  value={brandId != null ? String(brandId) : ''}
                  onChange={v => setBrandId(v ? Number(v) : null)}
                  placeholder={b.brandPlaceholder}
                  style={styles.select}
                />
              </View>
            ) : null}

            {showStep('model') ? (
              <View style={styles.field}>
                {label(b.stepModel, true)}
                <TextInput
                  value={model}
                  onChangeText={v => setModel(v.slice(0, MODEL_MAX))}
                  placeholder={b.modelPlaceholder}
                  placeholderTextColor={colors.subtle}
                  maxLength={MODEL_MAX}
                  style={[styles.input, showErrors && errModel && styles.inputErr, dirStyle]}
                />
                {suggestions.length > 0 ? (
                  <View style={[styles.pills, rowDir]}>
                    {suggestions.map(s => pill(s, s, false, () => setModel(s.slice(0, MODEL_MAX)), 'sparkles-outline'))}
                  </View>
                ) : null}
                {errModel ? fieldError(b.errModelRequired) : null}
              </View>
            ) : null}

            {showStep('storage') ? (
              <View style={styles.field}>
                {label(b.stepStorage, false)}
                <View style={[styles.pills, rowDir]}>
                  {STORAGE_PRESETS.map(p => pill(p, p, storage === p, () => setStorage(cur => (cur === p ? '' : p))))}
                </View>
                <TextInput
                  value={storage}
                  onChangeText={v => setStorage(v.slice(0, STORAGE_MAX))}
                  placeholder={b.storagePlaceholder}
                  placeholderTextColor={colors.subtle}
                  maxLength={STORAGE_MAX}
                  style={[styles.input, dirStyle]}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {showWhere ? (
          <View style={styles.card}>
            {section('location-outline', b.sectionWhere)}

            {showStep('area') ? (
              <View style={styles.field}>
                {label(b.stepArea, true)}
                <SearchableSelect
                  options={areaOptions}
                  value={areaId}
                  onChange={setAreaId}
                  placeholder={b.areaPlaceholder}
                  style={styles.select}
                />
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
                    placeholderTextColor={colors.subtle}
                    keyboardType="number-pad"
                    style={[styles.input, styles.budgetInput, showErrors && errBudget && styles.inputErr, dirStyle]}
                  />
                  <View style={styles.budgetDash} />
                  <TextInput
                    value={budgetMax}
                    onChangeText={v => setBudgetMax(digitsOnly(v))}
                    placeholder={b.budgetMax}
                    placeholderTextColor={colors.subtle}
                    keyboardType="number-pad"
                    style={[styles.input, styles.budgetInput, showErrors && errBudget && styles.inputErr, dirStyle]}
                  />
                </View>
                {errBudget ? fieldError(b.errBudgetRange) : null}
                <Text style={[styles.sub, dirStyle]}>{b.wantsLabel}</Text>
                <View style={[styles.pills, rowDir]}>
                  {WANTS.map(w => pill(w, wantLabel[w], wants.includes(w), () => toggleWant(w)))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.privacy}>
          <Text style={[styles.footer, dirStyle]}>{b.intakeFooter}</Text>
        </View>
      </ScrollView>

      <View style={styles.bar}>
        {error ? <Text style={[styles.errBox, dirStyle]}>{error}</Text> : null}
        <Button label={busy ? b.submitting : b.submit} variant="dk" size="lg" fullWidth loading={busy} onPress={submit} />
      </View>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.hero,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: 'hidden',
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.ss),
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    end: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.y,
    opacity: 0.14,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  heroTitle: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 26, color: colors.white },
  heroHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.g300 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md + 2,
    ...(dark ? { borderWidth: 1, borderColor: colors.border } : shadow.ss),
  },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.heading },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 22 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingBottom: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.yellowBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 24, color: colors.heading },
  summary: {
    backgroundColor: colors.yellowBg,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.y,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  summaryLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.yellowText },
  summaryText: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 22, color: colors.heading },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.card,
  },
  editText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.heading },
  field: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.heading },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
    backgroundColor: colors.placeholder,
  },
  tagText: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 17, color: colors.muted },
  select: { marginBottom: 0 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  inputErr: { borderColor: colors.red },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.placeholder,
  },
  pillOn: { backgroundColor: colors.yellowBg, borderColor: colors.y },
  pillPressed: { backgroundColor: colors.pressed },
  pillText: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 20, color: colors.text },
  pillTextOn: { fontFamily: fonts.bold, color: colors.heading },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetInput: { flex: 1 },
  budgetDash: { width: 10, height: 2, borderRadius: 1, backgroundColor: colors.dot },
  sub: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.text, marginTop: spacing.xs },
  err: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.red },
  errBox: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 20, color: colors.red },
  privacy: {
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  footer: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 20, color: colors.muted },
  bar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm + 4,
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
