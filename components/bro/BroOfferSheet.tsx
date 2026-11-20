import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { colors, darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { imgUrl, type Product } from '@/lib/api'
import { authFetch } from '@/lib/auth'
import {
  budgetFitOf,
  createBroOffer,
  getBroUsage,
  getOfferOptions,
  listSavedBroOffers,
  type BroApiError,
  type BroSavedOffer,
  type BroUsage,
  type BudgetFit,
  type CreateBroOfferResult,
  type OfferContent,
  type OfferOptions,
  type OptionReason,
} from '@/lib/bro'
import { BroOfferForm } from '@/components/bro/BroOfferForm'
import { BroUsageMeter } from '@/components/bro/BroUsageMeter'
import { BroButton } from '@/components/bro/BroButton'
import { useBroDir } from '@/components/bro/BroCardParts'
import { UpgradeModal } from '@/components/UpgradeModal'
import { BroOfferCapPicks } from '@/components/bro/BroOfferCapPicks'
import { categoryIcon, type BroOfferPick } from '@/components/bro/BroBoardCard'

type Tab = 'products' | 'scratch' | 'saved'

/** `/products/mine` also returns `expiredAt` (and could return `deletedAt`); the shared Product type omits them. */
type MyProduct = Product & { expiredAt?: string | null; deletedAt?: string | null }

/** A listing can back an offer only while it is live. */
function isAvailable(p: MyProduct): boolean {
  return p.isActive && !p.soldAt && !p.expiredAt && !p.deletedAt
}

type Picked =
  | { kind: 'product'; key: string; initial: OfferContent; images: string[] }
  | { kind: 'saved'; key: string; initial: OfferContent; savedOfferId: number }

function productPick(p: MyProduct): Picked {
  return {
    kind: 'product',
    key: `p${p.id}`,
    initial: {
      title: p.title,
      price: Number(p.price),
      locationId: p.location?.id ?? null,
      productId: p.id,
      // Prefill the note with the product description (form + DTO cap it at 280).
      sellerNote: p.description?.trim().slice(0, 280) || null,
    },
    images: [...p.images].sort((a, c) => (a.sortOrder ?? 0) - (c.sortOrder ?? 0)).map(i => i.url),
  }
}

function savedPick(s: BroSavedOffer): Picked {
  return {
    kind: 'saved',
    key: `s${s.id}`,
    savedOfferId: s.id,
    initial: {
      title: s.title,
      price: Number(s.price),
      locationId: s.locationId,
      scratches: s.scratches,
      hasBox: s.hasBox,
      hasInvoice: s.hasInvoice,
      hasWarranty: s.hasWarranty,
      warrantyNote: s.warrantyNote,
      sellerNote: s.sellerNote,
      images: s.images,
      productId: s.productId,
    },
  }
}

/** Why a row fits this request, shown under its price. */
interface Hint { reason: OptionReason | null; fit: BudgetFit | null; linkedSold?: boolean }

/** Server ranking first; anything it didn't rank keeps its original order at the end. */
function rankBy<T extends { id: number }>(list: T[], ranked: { id: number }[] | undefined): T[] {
  if (!ranked?.length) return list
  const pos = new Map(ranked.map((r, i) => [r.id, i]))
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, c) => (pos.get(a.item.id) ?? ranked.length + a.i) - (pos.get(c.item.id) ?? ranked.length + c.i))
    .map(x => x.item)
}

const FIT_COLOR: Record<BudgetFit, string> = { in: '#16a34a', near: '#ca8a04', over: '#ea580c' }

interface Props {
  visible: boolean
  requestId: number
  userType: 'client' | 'store'
  /** Shown in the header ("for request: <model>") when known. */
  modelText?: string
  /** Picks the header tile icon. */
  categoryName?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
  /** Open straight into this listing / saved offer (the board card's "matched" shortcut). */
  initialPick?: BroOfferPick
  onClose: () => void
  onSent: (offer: CreateBroOfferResult) => void
}

/** Bottom sheet for sending an offer on a board request: from a listing, from scratch, or from a saved offer. */
export function BroOfferSheet(props: Props) {
  // Remount the body per open so every open starts from a clean slate.
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={() => {}}>
      {props.visible && <SheetBody {...props} />}
    </Modal>
  )
}

function Notice({ text, onRetry, retryLabel, busy }: { text?: string; onRetry?: () => void; retryLabel?: string; busy?: boolean }) {
  const { dirStyle } = useBroDir()
  const styles = useStyles()
  return (
    <View style={styles.notice} accessibilityRole="alert">
      {busy && <ActivityIndicator color={colors.y} />}
      {text ? <Text style={[styles.noticeText, dirStyle]}>{text}</Text> : null}
      {onRetry && retryLabel ? <BroButton label={retryLabel} onPress={onRetry} /> : null}
    </View>
  )
}

function SheetBody({ requestId, userType, modelText, categoryName = null, budgetMin = null, budgetMax = null, initialPick, onClose, onSent }: Props) {
  const { locale, t } = useLocale()
  const b = t.bro
  const { ar, dirStyle, rowDir, colDir } = useBroDir()
  const styles = useStyles()
  const insets = useSafeAreaInsets()

  // null until the user picks a tab; until then the server's suggestion (or what has content) decides.
  const [userTab, setUserTab] = useState<Tab | null>(null)
  const [options, setOptions] = useState<OfferOptions | null>(null)
  const [optionsDone, setOptionsDone] = useState(false)
  const pendingPick = useRef(initialPick)
  const [usage, setUsage] = useState<BroUsage | null>(null)
  const [usageFailed, setUsageFailed] = useState(false)
  const [products, setProducts] = useState<MyProduct[] | null>(null)
  const [productsFailed, setProductsFailed] = useState(false)
  const [saved, setSaved] = useState<BroSavedOffer[] | null>(null)
  const [savedFailed, setSavedFailed] = useState(false)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  // Set when the offer went out but the product hit the client cap: the sheet stays open to explain
  // and offer the store upgrade; dismissing it then reports the sent offer.
  const [capResult, setCapResult] = useState<CreateBroOfferResult | null>(null)
  // In-flight work and the upgrade modal both block closing the sheet.
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const closeBlocked = submitting || uploading || showUpgrade

  // Each loader re-runs when its nonce bumps (retry).
  const [usageNonce, setUsageNonce] = useState(0)
  const [productsNonce, setProductsNonce] = useState(0)
  const [savedNonce, setSavedNonce] = useState(0)

  useEffect(() => {
    let alive = true
    getBroUsage()
      .catch(() => null)
      .then(u => {
        if (!alive) return
        if (u) { setUsage(u); setUsageFailed(false) } else setUsageFailed(true)
      })
    return () => { alive = false }
  }, [usageNonce])

  useEffect(() => {
    let alive = true
    authFetch<MyProduct[]>('/products/mine')
      .catch(() => null)
      .then(list => {
        if (!alive) return
        if (!list) { setProductsFailed(true); return }
        const live = list.filter(isAvailable)
        setProducts(live)
        setProductsFailed(false)
        if (pendingPick.current?.kind === 'product') {
          const want = pendingPick.current.id
          pendingPick.current = undefined
          const hit = live.find(p => p.id === want)
          if (hit) { setPicked(productPick(hit)); setUserTab('products') }
        }
      })
    return () => { alive = false }
  }, [productsNonce])

  // Saved offers load up front too: the default tab depends on whether any exist.
  useEffect(() => {
    let alive = true
    listSavedBroOffers()
      .catch(() => null)
      .then(list => {
        if (!alive) return
        if (!list) { setSavedFailed(true); return }
        setSaved(list)
        setSavedFailed(false)
        if (pendingPick.current?.kind === 'saved') {
          const want = pendingPick.current.id
          pendingPick.current = undefined
          const hit = list.find(s => s.id === want && s.available)
          if (hit) { setPicked(savedPick(hit)); setUserTab('saved') }
        }
      })
    return () => { alive = false }
  }, [savedNonce])

  useEffect(() => {
    let alive = true
    getOfferOptions(requestId)
      .catch(() => null)
      .then(o => {
        if (!alive) return
        setOptions(o)
        setOptionsDone(true)
      })
    return () => { alive = false }
  }, [requestId])

  const suggestedTab: Tab | null =
    options?.suggested.source === 'product' ? 'products'
      : options?.suggested.source === 'saved' ? 'saved'
        : options ? 'scratch' : null
  const fallbackTab: Tab | null =
    productsFailed || (products && products.length > 0) ? 'products'
      : products === null ? null
        : savedFailed || saved?.some(s => s.available) ? 'saved'
          : saved === null ? null : 'scratch'
  const tab: Tab | null = userTab ?? (optionsDone ? suggestedTab ?? fallbackTab : null)
  // Hide a tab only once it is known to be empty.
  const showProductsTab = !(products && products.length === 0)
  const showSavedTab = !(saved && saved.length === 0)

  const loadUsage = useCallback(() => setUsageNonce(n => n + 1), [])

  const dismiss = useCallback(() => {
    if (closeBlocked) return
    if (capResult) onSent(capResult)
    else onClose()
  }, [capResult, closeBlocked, onSent, onClose])

  const cap = usage?.offers.cap ?? null
  // Capped only when the free allowance is spent AND no bought offers remain (free ones are spent first).
  const capped = userType === 'client' && usage != null && cap != null && usage.offers.used >= cap && usage.offers.purchased === 0
  const numLocale = locale === 'ar' ? 'ar-EG' : 'en-US'

  function buyPack(id: number) {
    // The sheet is a Modal that would cover the pushed screen, so close it first.
    onClose()
    router.push(`/dashboard/buy-offers?pack=${id}` as never)
  }

  function price(v: number | string): string {
    return b.priceEgp.replace('{price}', Number(v).toLocaleString(numLocale))
  }

  function switchTab(next: Tab) {
    setUserTab(next)
    setPicked(null)
    setError(null)
  }

  function pick(p: Picked) {
    setError(null)
    setPicked(p)
  }

  async function submit(content: OfferContent, saveAsTemplate: boolean, saveAsProduct: boolean) {
    setError(null)
    setSubmitting(true)
    try {
      const body =
        picked?.kind === 'saved'
          ? { ...content, source: 'saved' as const, savedOfferId: picked.savedOfferId, saveAsProduct }
          : picked?.kind === 'product'
            ? { ...content, source: 'product' as const }
            : { ...content, source: 'scratch' as const, saveAsTemplate, saveAsProduct }
      const offer = await createBroOffer(requestId, body)
      if (offer.productSkippedReason === 'cap') setCapResult(offer)
      else onSent(offer)
    } catch (err) {
      const e = err as BroApiError
      const bodyMsg = (e.body as { message?: unknown } | undefined)?.message
      const capBody = e.body as { code?: unknown; cap?: unknown; used?: unknown; purchased?: unknown; resetsAt?: unknown } | undefined
      if (e.status === 429 && capBody?.code === 'BRO_CLIENT_OFFER_CAP' && typeof capBody.cap === 'number') {
        // Monthly cap hit: switch straight to the limit + upgrade view instead of a raw error.
        const capNum = capBody.cap
        const usedNum = typeof capBody.used === 'number' ? capBody.used : capNum
        const purchasedNum = typeof capBody.purchased === 'number' ? capBody.purchased : undefined
        const resetsAt = typeof capBody.resetsAt === 'string' ? capBody.resetsAt : undefined
        setUsage(u => ({
          yearMonth: u?.yearMonth ?? '',
          resetsAt: resetsAt ?? u?.resetsAt ?? '',
          offers: { used: Math.max(usedNum, capNum), cap: capNum, purchased: purchasedNum ?? u?.offers.purchased ?? 0 },
        }))
        setPicked(null)
      } else {
        setError((typeof bodyMsg === 'string' ? bodyMsg : e.message) || b.errGeneric)
      }
      // Limits changed under us (cap hit, duplicate offer): re-read the meter.
      if (e.status === 409 || e.status === 429) loadUsage()
    } finally {
      setSubmitting(false)
    }
  }

  function reasonLabel(r: OptionReason | null): string | null {
    if (r === 'model') return b.reasonModel
    if (r === 'brand') return b.reasonBrand
    if (r === 'category') return b.reasonCategory
    return null
  }

  function fitLabel(f: BudgetFit): string {
    return f === 'in' ? b.fitIn : f === 'near' ? b.fitNear : b.fitOver
  }

  function optionRow(o: {
    key: number
    title: string
    priceValue: number | string
    img: string | null
    hint: Hint
    best: boolean
    disabled?: boolean
    note?: string
    onPick: () => void
  }) {
    const reason = reasonLabel(o.hint.reason)
    const dim = o.disabled || (!o.best && o.hint.reason === 'other')
    const sub = o.best ? styles.subBest : styles.sub
    return (
      <Pressable
        key={o.key}
        onPress={o.onPick}
        disabled={o.disabled}
        accessibilityRole="button"
        accessibilityLabel={`${b.useThis}: ${o.title}`}
        style={[styles.row, rowDir, o.best && styles.rowBest, dim && styles.rowDim]}
      >
        {o.best ? (
          <View style={[styles.bestTag, ar ? { right: 14 } : { left: 14 }]}>
            <Text style={styles.bestTagText}>{b.bestTag}</Text>
          </View>
        ) : null}
        <View style={[styles.radio, o.best && styles.radioOn]} />
        {o.img ? <Image source={{ uri: o.img }} style={o.best ? styles.thumbBest : styles.thumb} /> : <View style={o.best ? styles.thumbBest : styles.thumb} />}
        <View style={[styles.rowText, colDir]}>
          <Text style={[o.best ? styles.rowTitleBest : styles.rowTitle, dirStyle]} numberOfLines={1}>{o.title}</Text>
          {reason || o.hint.fit || o.hint.linkedSold || o.note ? (
            <Text style={[sub, dirStyle]} numberOfLines={2}>
              {[
                reason ? <Text key="r" style={o.best ? styles.reasonBest : styles.reason}>{reason}</Text> : null,
                o.hint.fit ? <Text key="f" style={{ color: FIT_COLOR[o.hint.fit] }}>{fitLabel(o.hint.fit)}</Text> : null,
                o.hint.linkedSold ? <Text key="s" style={styles.sold}>{b.linkedSold}</Text> : null,
                o.note ? <Text key="n" style={styles.note}>{o.note}</Text> : null,
              ].filter(Boolean).flatMap((el, i) => (i === 0 ? [el] : [<Text key={`d${i}`} style={styles.reason}> · </Text>, el]))}
            </Text>
          ) : null}
        </View>
        <Text style={o.best ? styles.rowPriceBest : styles.rowPrice}>{price(o.priceValue)}</Text>
      </Pressable>
    )
  }

  /** Best pick first under its own label, the rest under "other options". */
  function optionList(best: ReactNode | null, rows: ReactNode[], intro?: string) {
    return (
      <View style={styles.list}>
        {best ? (
          <>
            <Text style={[styles.lbl, dirStyle]}>{b.bestForThis}</Text>
            {best}
            {rows.length > 0 ? <Text style={[styles.lbl, dirStyle, { marginTop: 4 }]}>{b.otherOptions}</Text> : null}
          </>
        ) : intro ? <Text style={[styles.lbl, dirStyle]}>{intro}</Text> : null}
        {rows}
      </View>
    )
  }

  function tabCount(k: Tab): { n: number; matched: boolean } | null {
    if (k === 'scratch') return null
    const ranked = k === 'products' ? options?.products : options?.saved
    const matched = ranked?.filter(r => r.reason !== 'other').length ?? 0
    if (matched > 0) return { n: matched, matched: true }
    const list = k === 'products' ? products : saved
    return list ? { n: list.length, matched: false } : null
  }

  const nf = (v: number) => Number(v).toLocaleString(numLocale)
  const tile = categoryIcon(categoryName)
  const min = Number(budgetMin ?? 0)
  const max = Number(budgetMax ?? 0)
  const budgetText = max > 0
    ? `${min > 0 && min < max
      ? b.budgetAmtRange.replace('{min}', nf(min)).replace('{max}', nf(max))
      : b.budgetAmtUpTo.replace('{max}', nf(max))} ${b.budgetCurrency}`
    : null

  const budget = { min: budgetMin, max: budgetMax }

  function renderBody() {
    if (picked) {
      return (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.backRow, rowDir]}>
            <Pressable
              onPress={() => { setPicked(null); setError(null) }}
              disabled={submitting || uploading}
              hitSlop={8}
              accessibilityRole="button"
              style={{ opacity: submitting || uploading ? 0.5 : 1 }}
            >
              <Text style={styles.backText}>{ar ? `→ ${b.backToList}` : `← ${b.backToList}`}</Text>
            </Pressable>
          </View>
          <BroOfferForm
            key={picked.key}
            notice={picked.kind === 'product' ? b.linkedPriceNote : undefined}
            initial={picked.initial}
            productImages={picked.kind === 'product' ? picked.images : []}
            showSave={false}
            showSaveProduct={picked.kind === 'saved' && picked.initial.productId == null}
            budget={budget}
            onSubmit={submit}
            onUploadingChange={setUploading}
            error={error}
          />
        </View>
      )
    }

    if (tab === null) return <Notice busy />

    if (tab === 'scratch') {
      return (
        <BroOfferForm
          key="scratch"
          notice={modelText ? b.scratchPrefillNote : undefined}
          initial={{ title: modelText ?? '', price: 0 }}
          productImages={[]}
          showSave
          showSaveProduct
          budget={budget}
          onSubmit={submit}
          onUploadingChange={setUploading}
          error={error}
        />
      )
    }

    if (tab === 'products') {
      if (productsFailed) return <Notice text={b.sheetLoadFailed} retryLabel={b.retry} onRetry={() => { setProductsFailed(false); setProducts(null); setProductsNonce(n => n + 1) }} />
      if (products === null) return <Notice busy />
      if (products.length === 0) return <Notice text={b.noProducts} />
      const meta = new Map(options?.products.map(o => [o.id, o]))
      const bestId = options?.suggested.source === 'product' ? options.suggested.productId : undefined
      const ranked = rankBy(products, options?.products)
      const best = bestId == null ? undefined : ranked.find(p => p.id === bestId)
      const row = (p: MyProduct) => {
        const m = meta.get(p.id)
        return optionRow({
          key: p.id,
          title: p.title,
          priceValue: p.price,
          img: imgUrl(p.images[0]?.url, { w: 160 }),
          hint: { reason: m?.reason ?? null, fit: m ? m.budgetFit : budgetFitOf(Number(p.price), budgetMax) },
          best: p === best,
          onPick: () => pick(productPick(p)),
        })
      }
      return optionList(best ? row(best) : null, ranked.filter(p => p !== best).map(row), b.pickProduct)
    }

    if (savedFailed) return <Notice text={b.sheetLoadFailed} retryLabel={b.retry} onRetry={() => { setSavedFailed(false); setSaved(null); setSavedNonce(n => n + 1) }} />
    if (saved === null) return <Notice busy />
    if (saved.length === 0) return <Notice text={b.noSavedOffers} />
    const meta = new Map(options?.saved.map(o => [o.id, o]))
    const bestId = options?.suggested.source === 'saved' ? options.suggested.savedOfferId : undefined
    const ranked = rankBy(saved, options?.saved)
    const best = bestId == null ? undefined : ranked.find(s => s.id === bestId && s.available)
    const row = (s: BroSavedOffer) => {
      const m = meta.get(s.id)
      return optionRow({
        key: s.id,
        title: s.title,
        priceValue: s.price,
        img: imgUrl(s.images[0], { w: 160 }),
        hint: { reason: m?.reason ?? null, fit: m ? m.budgetFit : budgetFitOf(Number(s.price), budgetMax), linkedSold: m?.linkedSold },
        best: s === best,
        disabled: !s.available,
        note: s.available ? undefined : b.savedUnavailableHint,
        onPick: () => pick(savedPick(s)),
      })
    }
    return optionList(best ? row(best) : null, ranked.filter(s => s !== best).map(row))
  }

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel={b.sheetClose} />
      <View style={[styles.sheet, colDir, { paddingBottom: insets.bottom }]} accessibilityViewIsModal>
        <View style={[styles.header, rowDir]}>
          <View style={[styles.tile, { backgroundColor: tile.bg }]}>
            <Text style={styles.tileIcon}>{tile.icon}</Text>
          </View>
          <View style={[styles.headerText, colDir]}>
            <Text style={[styles.small, dirStyle]}>{b.sheetSmall}</Text>
            <Text style={[styles.title, dirStyle]} numberOfLines={1}>{modelText || b.sheetTitle}</Text>
          </View>
          {budgetText ? <Text style={styles.budget} numberOfLines={1}>{budgetText}</Text> : null}
          <Pressable
            onPress={dismiss}
            disabled={closeBlocked}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={b.sheetClose}
            style={[styles.close, { opacity: closeBlocked ? 0.5 : 1 }]}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {usage && userType === 'client' && <BroUsageMeter usage={usage} />}
          {usageFailed && !usage && (
            <Notice text={b.sheetLoadFailed} retryLabel={b.retry} onRetry={() => { setUsageFailed(false); loadUsage() }} />
          )}

          {capResult ? (
            <View style={styles.center} accessibilityRole="alert">
              <Text style={styles.centerTitle}>{b.offerSentToast}</Text>
              <Text style={styles.centerBody}>
                {(capResult.canUpgradeToStore ? b.productCapSkippedUpgrade : b.productCapSkipped)
                  .replace('{cap}', String(capResult.productCap ?? ''))}
              </Text>
              <View style={styles.centerActions}>
                {capResult.canUpgradeToStore && (
                  <BroButton label={b.upgradeToStore} variant="yellow" size="md" onPress={() => setShowUpgrade(true)} />
                )}
                <BroButton label={b.done} size="md" onPress={dismiss} />
              </View>
            </View>
          ) : capped ? (
            <View style={styles.capPicks} accessibilityRole="alert">
              <BroOfferCapPicks
                cap={cap ?? 0}
                resetsAt={usage?.resetsAt}
                onUpgrade={() => setShowUpgrade(true)}
                onBuyPack={buyPack}
              />
            </View>
          ) : (
            <>
              <View style={[styles.tabs, rowDir]} accessibilityRole="tablist">
                {([
                  ...(showProductsTab ? [['products', b.srcProducts]] : []),
                  ...(showSavedTab ? [['saved', b.srcSaved]] : []),
                  ['scratch', b.srcScratch],
                ] as [Tab, string][]).map(([k, label]) => {
                  const on = tab === k
                  const count = tabCount(k)
                  return (
                    <Pressable
                      key={k}
                      onPress={() => switchTab(k)}
                      disabled={submitting || uploading}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={[styles.tab, rowDir, on && styles.tabOn]}
                    >
                      <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{label}</Text>
                      {count ? (
                        <Text style={[styles.badge, count.matched && styles.badgeMatched]} numberOfLines={1}>
                          {count.matched ? b.srcMatched.replace('{n}', nf(count.n)) : nf(count.n)}
                        </Text>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
              {renderBody()}
              {/* Errors from the list views (the form shows its own). */}
              {error && !picked && tab !== 'scratch' ? <Text style={[styles.error, dirStyle]}>{error}</Text> : null}
            </>
          )}
        </ScrollView>
      </View>
      <UpgradeModal visible={showUpgrade} mode="upgrade-to-store" onClose={() => setShowUpgrade(false)} />
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tile: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { fontSize: 24 },
  headerText: { flex: 1, minWidth: 0 },
  small: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.muted },
  title: { fontFamily: fonts.black, fontSize: 17, color: colors.heading },
  budget: {
    fontFamily: fonts.black,
    fontSize: 13,
    color: dark ? '#6ee7b7' : '#065f46',
    backgroundColor: colors.greenBg,
    borderWidth: 1,
    borderColor: dark ? colors.border : '#c8eed9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    maxWidth: 140,
  },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted },
  content: { padding: spacing.lg, gap: spacing.md },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.placeholder,
  },
  tabOn: { backgroundColor: colors.yellowBg, borderColor: colors.y },
  tabText: { fontFamily: fonts.extraBold, fontSize: 13.5, color: colors.muted, flexShrink: 1 },
  tabTextOn: { fontFamily: fonts.black, color: dark ? colors.heading : colors.dk },
  badge: {
    fontFamily: fonts.black,
    fontSize: 10.5,
    color: colors.g700,
    backgroundColor: colors.g300,
    borderRadius: 99,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  badgeMatched: { color: colors.white, backgroundColor: colors.green },
  backRow: { flexDirection: 'row' },
  backText: { fontFamily: fonts.extraBold, fontSize: 12.5, color: '#2952cc' },
  lbl: { fontFamily: fonts.black, fontSize: 12, color: colors.muted },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  rowBest: {
    borderWidth: 2,
    borderColor: colors.y,
    backgroundColor: dark ? colors.yellowBg : '#fffdf5',
    borderRadius: 16,
    padding: 12,
    marginTop: 6,
  },
  rowDim: { opacity: 0.55 },
  bestTag: { position: 'absolute', top: -11, backgroundColor: colors.y, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 1 },
  bestTagText: { fontFamily: fonts.black, fontSize: 11, color: colors.dk },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.g300, backgroundColor: colors.white },
  radioOn: { borderWidth: 7, borderColor: colors.dk },
  thumb: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.placeholder },
  thumbBest: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.placeholder },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.text },
  rowTitleBest: { fontFamily: fonts.black, fontSize: 14.5, color: colors.heading },
  rowPrice: { fontFamily: fonts.black, fontSize: 13.5, color: colors.price },
  rowPriceBest: { fontFamily: fonts.black, fontSize: 15.5, color: colors.price },
  sub: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.subtle, marginTop: 2 },
  subBest: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted, marginTop: 2 },
  reason: { color: colors.subtle },
  reasonBest: { color: colors.muted },
  sold: { color: '#c2410c' },
  note: { color: colors.red },
  notice: { alignItems: 'center', gap: 10, paddingVertical: spacing.md },
  noticeText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
  center: { alignItems: 'center', gap: 8, paddingVertical: spacing.sm },
  centerTitle: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading, textAlign: 'center' },
  centerBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  capPicks: { paddingVertical: spacing.sm },
  centerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: 6 },
  error: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
