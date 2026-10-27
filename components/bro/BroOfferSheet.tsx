import { useCallback, useEffect, useState } from 'react'
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
import { Ionicons } from '@expo/vector-icons'
import { colors, darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { imgUrl, type Product } from '@/lib/api'
import { authFetch } from '@/lib/auth'
import {
  createBroOffer,
  getBroUsage,
  listSavedBroOffers,
  type BroApiError,
  type BroSavedOffer,
  type BroUsage,
  type CreateBroOfferResult,
  type OfferContent,
} from '@/lib/bro'
import { BroOfferForm } from '@/components/bro/BroOfferForm'
import { BroUsageMeter } from '@/components/bro/BroUsageMeter'
import { BroButton } from '@/components/bro/BroButton'
import { useBroDir } from '@/components/bro/BroCardParts'
import { UpgradeModal } from '@/components/UpgradeModal'

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

interface Props {
  visible: boolean
  requestId: number
  userType: 'client' | 'store'
  /** Shown in the header ("for request: <model>") when known. */
  modelText?: string
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

function SheetBody({ requestId, userType, modelText, onClose, onSent }: Props) {
  const { locale, t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir, colDir } = useBroDir()
  const styles = useStyles()
  const insets = useSafeAreaInsets()

  const [tab, setTab] = useState<Tab>('products')
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
        if (list) { setProducts(list.filter(isAvailable)); setProductsFailed(false) } else setProductsFailed(true)
      })
    return () => { alive = false }
  }, [productsNonce])

  // Saved offers load lazily, the first time the tab is opened.
  const savedWanted = tab === 'saved'
  useEffect(() => {
    if (!savedWanted) return
    let alive = true
    listSavedBroOffers()
      .catch(() => null)
      .then(list => {
        if (!alive) return
        if (list) { setSaved(list); setSavedFailed(false) } else setSavedFailed(true)
      })
    return () => { alive = false }
  }, [savedWanted, savedNonce])

  const loadUsage = useCallback(() => setUsageNonce(n => n + 1), [])

  const dismiss = useCallback(() => {
    if (closeBlocked) return
    if (capResult) onSent(capResult)
    else onClose()
  }, [capResult, closeBlocked, onSent, onClose])

  const cap = usage?.offers.cap ?? null
  const capped = userType === 'client' && usage != null && cap != null && usage.offers.used >= cap
  const numLocale = locale === 'ar' ? 'ar-EG' : 'en-US'

  function resetDate(): string {
    if (!usage) return ''
    const d = new Date(usage.resetsAt)
    try {
      return d.toLocaleDateString(numLocale, { day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' })
    } catch {
      return d.toLocaleDateString()
    }
  }

  function price(v: number | string): string {
    return b.priceEgp.replace('{price}', Number(v).toLocaleString(numLocale))
  }

  function switchTab(next: Tab) {
    setTab(next)
    setPicked(null)
    setError(null)
  }

  function pickProduct(p: MyProduct) {
    setError(null)
    setPicked({
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
    })
  }

  function pickSaved(s: BroSavedOffer) {
    setError(null)
    setPicked({
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
    })
  }

  async function submit(content: OfferContent, saveAsTemplate: boolean, saveAsProduct: boolean) {
    setError(null)
    setSubmitting(true)
    try {
      const body =
        tab === 'saved' && picked?.kind === 'saved'
          ? { ...content, source: 'saved' as const, savedOfferId: picked.savedOfferId, saveAsProduct }
          : tab === 'products'
            ? { ...content, source: 'product' as const }
            : { ...content, source: 'scratch' as const, saveAsTemplate, saveAsProduct }
      const offer = await createBroOffer(requestId, body)
      if (offer.productSkippedReason === 'cap') setCapResult(offer)
      else onSent(offer)
    } catch (err) {
      const e = err as BroApiError
      const bodyMsg = (e.body as { message?: unknown } | undefined)?.message
      const capBody = e.body as { code?: unknown; cap?: unknown; used?: unknown; resetsAt?: unknown } | undefined
      if (e.status === 429 && capBody?.code === 'BRO_CLIENT_OFFER_CAP' && typeof capBody.cap === 'number') {
        // Monthly cap hit: switch straight to the limit + upgrade view instead of a raw error.
        const capNum = capBody.cap
        const usedNum = typeof capBody.used === 'number' ? capBody.used : capNum
        const resetsAt = typeof capBody.resetsAt === 'string' ? capBody.resetsAt : undefined
        setUsage(u => ({
          yearMonth: u?.yearMonth ?? '',
          resetsAt: resetsAt ?? u?.resetsAt ?? '',
          offers: { used: Math.max(usedNum, capNum), cap: capNum },
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

  function renderRow(key: number, title: string, priceValue: number | string, img: string | null, onUse: () => void, opts?: { disabled?: boolean; hint?: string }) {
    return (
      <View key={key} style={[styles.row, rowDir, opts?.disabled && styles.rowDim]}>
        {img ? <Image source={{ uri: img }} style={styles.thumb} /> : <View style={styles.thumb} />}
        <View style={[styles.rowText, colDir]}>
          <Text style={[styles.rowTitle, dirStyle]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.rowPrice, dirStyle]}>{price(priceValue)}</Text>
          {opts?.hint ? <Text style={[styles.rowHint, dirStyle]}>{opts.hint}</Text> : null}
        </View>
        <BroButton label={b.useThis} variant="yellow" disabled={opts?.disabled} onPress={onUse} />
      </View>
    )
  }

  function renderBody() {
    if (picked) {
      return (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.backRow, rowDir]}>
            <BroButton label={b.backToList} icon="arrow-back" onPress={() => { setPicked(null); setError(null) }} disabled={submitting || uploading} />
          </View>
          <BroOfferForm
            key={picked.key}
            initial={picked.initial}
            productImages={picked.kind === 'product' ? picked.images : []}
            showSave={false}
            showSaveProduct={picked.kind === 'saved' && picked.initial.productId == null}
            onSubmit={submit}
            onUploadingChange={setUploading}
            error={error}
          />
        </View>
      )
    }

    if (tab === 'scratch') {
      return (
        <BroOfferForm
          key="scratch"
          initial={{ title: '', price: 0 }}
          productImages={[]}
          showSave
          showSaveProduct
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
      return (
        <View style={styles.list}>
          <Text style={[styles.hint, dirStyle]}>{b.pickProduct}</Text>
          {products.map(p => renderRow(p.id, p.title, p.price, imgUrl(p.images[0]?.url, { w: 160 }), () => pickProduct(p)))}
        </View>
      )
    }

    if (savedFailed) return <Notice text={b.sheetLoadFailed} retryLabel={b.retry} onRetry={() => { setSavedFailed(false); setSaved(null); setSavedNonce(n => n + 1) }} />
    if (saved === null) return <Notice busy />
    if (saved.length === 0) return <Notice text={b.noSavedOffers} />
    return (
      <View style={styles.list}>
        {saved.map(s =>
          renderRow(s.id, s.title, s.price, imgUrl(s.images[0], { w: 160 }), () => pickSaved(s), {
            disabled: !s.available,
            hint: s.available ? undefined : b.savedUnavailableHint,
          }),
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel={b.sheetClose} />
      <View style={[styles.sheet, colDir, { paddingBottom: insets.bottom }]} accessibilityViewIsModal>
        <View style={[styles.header, rowDir]}>
          <View style={[styles.headerText, colDir]}>
            <Text style={[styles.title, dirStyle]}>{b.sheetTitle}</Text>
            {modelText ? <Text style={[styles.subtitle, dirStyle]} numberOfLines={1}>{b.sheetFor.replace('{model}', modelText)}</Text> : null}
          </View>
          <Pressable
            onPress={dismiss}
            disabled={closeBlocked}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={b.sheetClose}
            style={{ opacity: closeBlocked ? 0.4 : 1 }}
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
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
            <View style={styles.center} accessibilityRole="alert">
              <Text style={styles.centerTitle}>{b.capBlockTitle}</Text>
              <Text style={styles.centerBody}>{b.capReached.replace('{date}', resetDate())}</Text>
              <Text style={styles.centerBody}>{b.upgradeNudge}</Text>
              <BroButton label={b.capUpgradeCta} variant="yellow" size="md" onPress={() => setShowUpgrade(true)} />
            </View>
          ) : (
            <>
              <View style={[styles.tabs, rowDir]} accessibilityRole="tablist">
                {([
                  ['products', b.tabFromProducts],
                  ['scratch', b.tabScratch],
                  ['saved', b.tabSaved],
                ] as const).map(([k, label]) => (
                  <BroButton
                    key={k}
                    label={label}
                    variant={tab === k ? 'dark' : 'outline'}
                    selected={tab === k}
                    disabled={submitting || uploading}
                    onPress={() => switchTab(k)}
                  />
                ))}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.white },
  subtitle: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  content: { padding: spacing.lg, gap: spacing.md },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  list: { gap: spacing.sm },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  rowDim: { opacity: 0.7 },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.placeholder },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.heading },
  rowPrice: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  rowHint: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.red },
  backRow: { flexDirection: 'row' },
  notice: { alignItems: 'center', gap: 10, paddingVertical: spacing.md },
  noticeText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
  center: { alignItems: 'center', gap: 8, paddingVertical: spacing.sm },
  centerTitle: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading, textAlign: 'center' },
  centerBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  centerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: 6 },
  error: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
