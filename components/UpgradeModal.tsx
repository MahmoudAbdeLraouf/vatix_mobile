import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { EventSubscription, Purchase, PurchaseError } from 'react-native-iap'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { AUTH_ERR, authErrorMessage, authFetch, authPost, updateStoredUser } from '@/lib/auth'
import {
  getSiteSettings,
  getSubscriptionPlans,
  PlanData,
  SiteSettings,
  WalletBalance,
} from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'
import { IS_IOS } from '@/lib/platform'
import {
  addPurchaseErrorListener,
  addPurchaseUpdatedListener,
  endIap,
  fetchIosProducts,
  finishIosPurchase,
  getIosJws,
  initIap,
  requestIosPurchase,
  requireIosProduct,
} from '@/lib/iap'
import {
  SUBSCRIPTION_SKUS,
  getIapProduct,
  iosFallbackDisplayPrice,
  subscriptionSkuForStoreType,
} from '@/lib/iap-products'
import { finalizePaymentSuccess, verifyIapPurchase } from '@/lib/payment'

// Mirrors vatix_website/components/upgrade-modal.tsx
// Three modes × multi-step flow:
//   Mode: upgrade-to-store | upgrade-to-plus | cancel-store
//   Step: store-info → pay-method → instapay → instapay-done
//         pay-method → mobile-wallet → mobile-wallet-done
//         pay-method → wallet → wallet-done
// upgrade-to-plus skips store-info (user already has store profile).
// Store materialization is deferred: store metadata is sent inside payment
// `metadata` so the backend creates the profile only after admin approval
// (InstaPay / mobile-wallet) or immediately (wallet).

export type UpgradeMode = 'upgrade-to-store' | 'upgrade-to-plus' | 'cancel-store'
type Step =
  | 'store-info'
  | 'pay-method'
  | 'instapay'
  | 'instapay-done'
  | 'mobile-wallet'
  | 'mobile-wallet-done'
  | 'wallet'
  | 'wallet-done'
  | 'apple-iap'
  | 'apple-iap-done'

export type BillingCycle = 'monthly' | 'yearly'

interface Props {
  visible: boolean
  mode: UpgradeMode
  onClose: () => void
  onSuccess?: () => void
  // Only meaningful for `upgrade-to-plus`. Normal-store subscriptions are
  // monthly-only. Ignored on iOS (App Store Connect has monthly SKUs only, so
  // the effective cycle is forced to `monthly` there).
  cycle?: BillingCycle
}

const PLAN_META: Record<
  'store' | 'store_plus',
  { code: string; fallbackPrice: Record<BillingCycle, number> }
> = {
  store: {
    code: 'subscription_store',
    fallbackPrice: { monthly: 300, yearly: 3000 },
  },
  store_plus: {
    code: 'subscription_store_plus',
    fallbackPrice: { monthly: 500, yearly: 5000 },
  },
}

// LocaleProvider applies `direction: 'rtl'` at the tree root. Under inherited
// RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve visually
// BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so the first
// child anchors to the physical right. `colDir` restores RTL context inside
// those rows so nested text uses `textAlign: 'auto'` = start alignment.
function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar
      ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const })
      : null,
    colDir: ar ? ({ direction: 'rtl' as const }) : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
    trailAlign: {
      alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
    },
  }
}

export function UpgradeModal({ visible, mode, onClose, onSuccess, cycle }: Props) {
  const { t } = useLocale()
  const { ar, rowDir } = useDir()
  const insets = useSafeAreaInsets()
  const { user, refetchUser } = useAuth()

  // A client tapping "Upgrade to Plus" has no storeProfile yet, so they must
  // still run store-info + handleCreateStore before payment. Only skip that
  // step when the user is already a store (upgrading tier).
  const userType = user?.type
  const hasStoreAlready =
    userType === 'STORE' ||
    userType === 'store' ||
    userType === 'STORE_PLUS' ||
    userType === 'store_plus'
  const needsStoreCreation = mode !== 'cancel-store' && !hasStoreAlready

  const [step, setStep] = useState<Step>(
    needsStoreCreation ? 'store-info' : 'pay-method',
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Mount-time data
  const [plans, setPlans] = useState<PlanData[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  // StoreKit-formatted prices keyed by SKU. iOS-only; empty on Android/web.
  // Sourced from App Store Connect so Apple's 30% commission gross-up is
  // reflected without duplicating the pricing table in the client.
  const [iosPriceMap, setIosPriceMap] = useState<Record<string, string>>({})

  // Store-info form — storeType is fully determined by mode (which CTA was tapped);
  // no in-modal selector.
  const storeType: 'store' | 'store_plus' = mode === 'upgrade-to-plus' ? 'store_plus' : 'store'
  const [storeName, setStoreName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [cover, setCover] = useState('')

  // Billing cycle. Only meaningful for `upgrade-to-plus`. Normal-store
  // subscriptions are monthly-only. iOS is forced to `monthly` because App
  // Store Connect only has monthly SKUs — a yearly picker there would fail at
  // `requireIosProduct`.
  const initialCycle: BillingCycle =
    IS_IOS || mode !== 'upgrade-to-plus' ? 'monthly' : (cycle ?? 'monthly')
  const [effectiveCycle, setEffectiveCycle] = useState<BillingCycle>(initialCycle)

  // Path A vs B for Store Plus signup (mirrors vatix_website/components/upgrade-modal.tsx):
  //   'pay'   — Path A: pay upfront, get Store Plus instantly (no trial).
  //   'trial' — Path B: skip payment, create a standard-store profile on the
  //             14-day trial; user can pay to upgrade to Plus later from the
  //             dashboard. Only meaningful when needsStoreCreation && upgrade-to-plus.
  const [plusPath, setPlusPath] = useState<'pay' | 'trial'>('pay')

  // InstaPay form
  const [screenshotKey, setScreenshotKey] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')

  // Reset when opened
  useEffect(() => {
    if (!visible) return
    setStep(needsStoreCreation ? 'store-info' : 'pay-method')
    setErr('')
    setBusy(false)
    setStoreName('')
    setDescription('')
    setLogo('')
    setCover('')
    setScreenshotKey('')
    setBuyerPhone('')
    setEffectiveCycle(
      IS_IOS || mode !== 'upgrade-to-plus' ? 'monthly' : (cycle ?? 'monthly'),
    )
    setPlusPath('pay')
  }, [visible, mode, needsStoreCreation, cycle])

  // Load plans + settings + wallet on open
  useEffect(() => {
    if (!visible) return
    let live = true
    ;(async () => {
      const [p, s, w] = await Promise.all([
        getSubscriptionPlans().catch(() => [] as PlanData[]),
        getSiteSettings().catch(() => null),
        authFetch<WalletBalance>('/payments/wallet/balance'),
      ])
      if (!live) return
      setPlans(p)
      setSettings(s)
      setWallet(w)
      if (IS_IOS) {
        try {
          const products = await fetchIosProducts(SUBSCRIPTION_SKUS, 'subs')
          if (!live) return
          const map: Record<string, string> = {}
          for (const prod of products) {
            if (prod?.id && prod?.displayPrice) map[prod.id] = prod.displayPrice
          }
          setIosPriceMap(map)
          if (products.length < SUBSCRIPTION_SKUS.length) {
            const returned = products.map(p => p?.id).join(', ') || '<none>'
            console.warn(
              `[IAP] subs fetch incomplete requested=[${SUBSCRIPTION_SKUS.join(', ')}] returned=[${returned}]`,
            )
            setErr(t.iapProductUnavailable)
          }
        } catch (e) {
          console.warn('[IAP] subs fetch threw:', e)
          if (live) setErr(t.iapProductUnavailable)
        }
      }
    })()
    return () => {
      live = false
    }
  }, [visible])

  // Selected plan amount for pay-method / card / instapay / wallet steps.
  // Cycle-scoped: for store_plus we match on both storeType AND billingCycle so
  // the yearly tier surfaces its own DB price (falls back to PLAN_META fallback
  // for the active cycle when the plan row is missing). Normal store is
  // monthly-only, so cycle is effectively pinned to 'monthly'.
  const selectedType: 'store' | 'store_plus' = storeType
  const selectedPlan = useMemo(() => {
    const meta = PLAN_META[selectedType]
    const fallback = meta.fallbackPrice[effectiveCycle]
    const priceStr = plans.find(
      p => p.storeType === selectedType && (p.billingCycle ?? 'monthly') === effectiveCycle,
    )?.price
    const priceNum = priceStr != null ? Number(priceStr) : fallback
    return {
      code: meta.code,
      amount: Number.isFinite(priceNum) ? priceNum : fallback,
    }
  }, [plans, selectedType, effectiveCycle])

  const walletBalance = wallet?.balance ?? null

  // On iOS, prefer the StoreKit-formatted price for the selected plan. Falls
  // back to the grossed-up App Store Connect tier (999 / 1699 EGP) when
  // StoreKit is unreachable (Expo Go, dev, offline) so the UI never shows the
  // pre-commission backend price on an iOS build.
  const iosDisplayPrice = IS_IOS
    ? (iosPriceMap[subscriptionSkuForStoreType(storeType)] ??
      iosFallbackDisplayPrice(subscriptionSkuForStoreType(storeType)))
    : undefined

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleCancelStore() {
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/user/cancel-store', {})
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      onSuccess?.()
      onClose()
      router.replace('/dashboard')
    } catch (e: unknown) {
      setErr(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  // Path B for Store Plus signup: materialize a standard-store profile on the
  // 14-day trial without any payment. storeType is forced to 'store' regardless
  // of the mode — Store Plus itself does NOT get a free trial (spec).
  async function handleTrialSignup() {
    if (!storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/user/upgrade-to-store', {
        storeName: storeName.trim(),
        storeType: 'store',
        description: description.trim() || undefined,
        logo: logo || undefined,
        cover: cover || undefined,
      })
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      onSuccess?.()
      onClose()
      router.replace('/dashboard')
    } catch (e: unknown) {
      setErr(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  // Build metadata for a subscription payment. When `needsStoreCreation` is
  // true, the backend materializes the store profile from these fields after
  // the payment is approved (or immediately, for wallet). Do NOT create the
  // store before payment — that leaves orphaned store profiles when the
  // payment is later declined or abandoned.
  function buildStoreMetadata(): Record<string, unknown> {
    if (!needsStoreCreation) return {}
    return {
      storeName: storeName.trim(),
      storeType,
      description: description.trim() || undefined,
      logo: logo || undefined,
      cover: cover || undefined,
    }
  }

  async function handleInstapaySubmit() {
    if (needsStoreCreation && !storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return
    }
    if (!screenshotKey) {
      setErr(ar ? 'صورة التحويل مطلوبة' : 'Screenshot required')
      return
    }
    if (!buyerPhone.trim()) {
      setErr(ar ? 'رقم الهاتف مطلوب' : 'Phone number required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await authPost('/payments/instapay/subscriptions', {
        type: selectedPlan.code,
        billingCycle: effectiveCycle,
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
        metadata: buildStoreMetadata(),
      })
      setStep('instapay-done')
    } catch (e: unknown) {
      setErr(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  async function handleMobileWalletSubmit() {
    if (needsStoreCreation && !storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return
    }
    if (!screenshotKey) {
      setErr(ar ? 'صورة التحويل مطلوبة' : 'Screenshot required')
      return
    }
    if (!buyerPhone.trim()) {
      setErr(ar ? 'رقم الهاتف مطلوب' : 'Phone number required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await authPost('/payments/mobile-wallet/subscriptions', {
        type: selectedPlan.code,
        billingCycle: effectiveCycle,
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
        metadata: buildStoreMetadata(),
      })
      setStep('mobile-wallet-done')
    } catch (e: unknown) {
      setErr(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  async function handleWalletPayment() {
    if (needsStoreCreation && !storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/payments/wallet/pay', {
        type: selectedPlan.code,
        billingCycle: effectiveCycle,
        metadata: buildStoreMetadata(),
      })
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      const fresh = await authFetch<WalletBalance>('/payments/wallet/balance')
      setWallet(fresh)
      setStep('wallet-done')
    } catch (e: unknown) {
      setErr(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  // App Store §3.1.1: iOS subscriptions must use Apple IAP. Flow:
  //   1. init StoreKit  2. fetch product  3. requestPurchase (fire-and-forget)
  //   4. resolve via purchaseUpdatedListener  5. extract JWS
  //   6. POST /payments/iap/verify with store metadata
  //   7. finishTransaction (ONLY after backend verify succeeds — finishing
  //      earlier loses the transaction if the server call fails)
  //   8. refresh session + user profile.
  // User-cancels (ErrorCode.UserCancelled == "user-cancelled") return silently to pay-method.
  async function handleAppleIapPurchase() {
    if (needsStoreCreation && !storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return
    }
    const sku = subscriptionSkuForStoreType(storeType)
    const product = getIapProduct(sku)
    if (!product) {
      console.warn(`[IAP] subscription product not cached for sku=${sku}`)
      setErr(t.iapProductUnavailable)
      return
    }

    setErr('')
    setStep('apple-iap')
    setBusy(true)

    // Object wrapper avoids TS control-flow narrowing `let` closure-captured
    // subscriptions to `never` in the `finally` block.
    const subs: { updated: EventSubscription | null; error: EventSubscription | null } = {
      updated: null,
      error: null,
    }
    let cancelled = false

    try {
      await initIap()
      await requireIosProduct(sku, product.type)

      const purchase = await new Promise<Purchase>((resolve, reject) => {
        subs.updated = addPurchaseUpdatedListener(p => {
          if (p.productId === sku) resolve(p)
        })
        subs.error = addPurchaseErrorListener((e: PurchaseError) => {
          if (e.code === 'user-cancelled' || /cancel/i.test(e.message ?? '')) {
            cancelled = true
            reject(new Error('__CANCELLED__'))
            return
          }
          console.warn('[IAP] purchase error', e)
          if (e.code === 'sku-not-found') {
            reject(new Error(AUTH_ERR.IAP_PRODUCT_UNAVAILABLE))
            return
          }
          reject(new Error(e.message || 'Purchase failed'))
        })
        requestIosPurchase(sku, product.type).catch(reject)
      })

      const jws = await getIosJws(purchase)
      if (!jws) {
        throw new Error(ar ? 'تعذر التحقق من العملية' : 'Could not verify transaction')
      }

      await verifyIapPurchase({
        signedTransaction: jws,
        metadata: { ...buildStoreMetadata(), billingCycle: effectiveCycle },
      })

      await finishIosPurchase(purchase, product.isConsumable)
      await finalizePaymentSuccess()
      await refetchUser()

      setStep('apple-iap-done')
    } catch (e: unknown) {
      if (cancelled) {
        setStep('pay-method')
      } else {
        setErr(authErrorMessage(e, t))
        setStep('pay-method')
      }
    } finally {
      subs.updated?.remove()
      subs.error?.remove()
      await endIap()
      setBusy(false)
    }
  }

  // ─── Title ─────────────────────────────────────────────────────────────────

  const currencyLabel = ar ? 'ج.م' : 'EGP'
  const cycleUnit = effectiveCycle === 'yearly' ? t.yearlyBilling : t.monthlyBilling
  const priceLabel = iosDisplayPrice
    ? iosDisplayPrice
    : `${selectedPlan.amount} ${currencyLabel} / ${cycleUnit}`
  const title =
    mode === 'cancel-store'
      ? t.cancelStore
      : mode === 'upgrade-to-plus'
        ? `${t.upgradeToStorePlus} · ${priceLabel}`
        : `${t.upgradeToStore} · ${priceLabel}`

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text
              style={[styles.sheetTitle, { writingDirection: ar ? 'rtl' : 'ltr' }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior="padding"
            enabled={Platform.OS === 'ios'}
            keyboardVerticalOffset={20}
          >
            <ScrollView
              contentContainerStyle={{ padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {mode === 'cancel-store' ? (
                <CancelStorePanel
                  err={err}
                  busy={busy}
                  onCancel={onClose}
                  onConfirm={handleCancelStore}
                  confirmText={t.cancelStoreConfirm}
                />
              ) : step === 'store-info' ? (
                <StoreInfoPanel
                  storeName={storeName}
                  onStoreNameChange={setStoreName}
                  description={description}
                  onDescriptionChange={setDescription}
                  logo={logo}
                  onLogoChange={setLogo}
                  cover={cover}
                  onCoverChange={setCover}
                  price={selectedPlan.amount}
                  iosDisplayPrice={iosDisplayPrice}
                  cycle={effectiveCycle}
                  mode={mode}
                  plusPath={plusPath}
                  onPlusPathChange={setPlusPath}
                  onTrialStart={handleTrialSignup}
                  err={err}
                  busy={busy}
                  onBack={onClose}
                  onNext={() => {
                    if (!storeName.trim()) {
                      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
                      return
                    }
                    setErr('')
                    setStep('pay-method')
                  }}
                />
              ) : step === 'pay-method' ? (
                <PayMethodPanel
                  price={selectedPlan.amount}
                  iosDisplayPrice={iosDisplayPrice}
                  cycle={effectiveCycle}
                  onCycleChange={setEffectiveCycle}
                  showCyclePicker={storeType === 'store_plus' && !IS_IOS}
                  settings={settings}
                  walletBalance={walletBalance}
                  err={err}
                  busy={busy}
                  hasBack={needsStoreCreation}
                  isCreatingStore={needsStoreCreation}
                  onBack={() =>
                    needsStoreCreation ? setStep('store-info') : onClose()
                  }
                  onPickInstapay={() => {
                    setErr('')
                    setStep('instapay')
                  }}
                  onPickMobileWallet={() => {
                    setErr('')
                    setStep('mobile-wallet')
                  }}
                  onPickWallet={() => {
                    setErr('')
                    setStep('wallet')
                  }}
                  onPickAppleIap={handleAppleIapPurchase}
                />
              ) : step === 'instapay' ? (
                <InstapayPanel
                  settings={settings}
                  price={selectedPlan.amount}
                  screenshotKey={screenshotKey}
                  onScreenshotChange={setScreenshotKey}
                  buyerPhone={buyerPhone}
                  onBuyerPhoneChange={setBuyerPhone}
                  err={err}
                  busy={busy}
                  onBack={() => setStep('pay-method')}
                  onSubmit={handleInstapaySubmit}
                />
              ) : step === 'instapay-done' ? (
                <DonePanel
                  title={t.instapaySubmitted}
                  body={t.paymentPendingBody}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  ctaLabel={t.continueToStore}
                />
              ) : step === 'mobile-wallet' ? (
                <MobileWalletPanel
                  settings={settings}
                  price={selectedPlan.amount}
                  screenshotKey={screenshotKey}
                  onScreenshotChange={setScreenshotKey}
                  buyerPhone={buyerPhone}
                  onBuyerPhoneChange={setBuyerPhone}
                  err={err}
                  busy={busy}
                  onBack={() => setStep('pay-method')}
                  onSubmit={handleMobileWalletSubmit}
                />
              ) : step === 'mobile-wallet-done' ? (
                <DonePanel
                  title={t.mobileWalletSubmitted}
                  body={t.paymentPendingBody}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  ctaLabel={t.continueToStore}
                />
              ) : step === 'wallet' ? (
                <WalletPanel
                  price={selectedPlan.amount}
                  iosDisplayPrice={iosDisplayPrice}
                  walletBalance={walletBalance}
                  err={err}
                  busy={busy}
                  onBack={() => setStep('pay-method')}
                  onPay={handleWalletPayment}
                />
              ) : step === 'wallet-done' ? (
                <DonePanel
                  title={t.paymentSuccess}
                  body={t.paymentSuccessBody}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  ctaLabel={t.continueToStore}
                />
              ) : step === 'apple-iap' ? (
                <AppleIapPanel err={err} />
              ) : step === 'apple-iap-done' ? (
                <DonePanel
                  title={t.paymentSuccess}
                  body={t.paymentSuccessBody}
                  onClose={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  ctaLabel={t.continueToStore}
                />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function ErrorBox({ err }: { err: string }) {
  const { rowDir, colDir, dirStyle } = useDir()
  if (!err) return null
  return (
    <View style={[styles.errorBox, rowDir]}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
      <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
        <Text style={[styles.errorText, dirStyle]}>{err}</Text>
      </View>
    </View>
  )
}

function StoreInfoPanel(props: {
  storeName: string
  onStoreNameChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  logo: string
  onLogoChange: (v: string) => void
  cover: string
  onCoverChange: (v: string) => void
  price: number
  iosDisplayPrice?: string
  cycle: BillingCycle
  mode: UpgradeMode
  plusPath: 'pay' | 'trial'
  onPlusPathChange: (p: 'pay' | 'trial') => void
  onTrialStart: () => void
  err: string
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  const { storeName, onStoreNameChange, mode, plusPath, onPlusPathChange } = props
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const cycleUnit = props.cycle === 'yearly' ? t.yearlyBilling : t.monthlyBilling
  const showPlusPathPicker = mode === 'upgrade-to-plus'
  const isTrialPath = showPlusPathPicker && plusPath === 'trial'

  return (
    <View>
      <Input
        label={ar ? 'اسم المتجر *' : 'Store name *'}
        value={storeName}
        onChangeText={onStoreNameChange}
        placeholder={ar ? 'مثال: متجر إلكترونيات القاهرة' : 'e.g. Cairo Electronics'}
      />
      <Input
        label={t.storeDescription}
        value={props.description}
        onChangeText={props.onDescriptionChange}
        placeholder={ar ? 'وصف موجز لمتجرك' : 'Short store description'}
        multiline
        numberOfLines={3}
        style={{ height: 84, textAlignVertical: 'top', paddingTop: 12 }}
      />

      <FileUpload
        label={t.storeLogo}
        value={props.logo}
        onChange={props.onLogoChange}
        aspect="square"
      />
      <FileUpload
        label={t.storeCover}
        value={props.cover}
        onChange={props.onCoverChange}
        aspect="wide"
      />

      {showPlusPathPicker ? (
        <View style={colDir}>
          <Text style={[styles.sectionLabel, dirStyle]}>
            {ar ? 'كيف تريد البدء؟ *' : 'How would you like to start? *'}
          </Text>
          <View style={styles.plusPathList}>
            <Pressable
              onPress={() => onPlusPathChange('pay')}
              style={[
                styles.plusPathCard,
                plusPath === 'pay' && { borderColor: colors.y, backgroundColor: colors.yl },
              ]}
              disabled={props.busy}
            >
              <View style={[styles.plusPathHeader, rowDir]}>
                <Text style={styles.plusPathIcon}>💳</Text>
                <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
                  <Text style={[styles.plusPathTitle, dirStyle]}>
                    {ar
                      ? 'ادفع الآن واحصل على Store Plus فوراً'
                      : 'Pay now, get Store Plus instantly'}
                  </Text>
                  <Text style={[styles.plusPathHint, dirStyle]}>
                    {ar
                      ? '⭐ صفحة متجر مخصصة + مميزات كاملة — بدون فترة تجربة'
                      : '⭐ Dedicated storefront + full features — no trial'}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              onPress={() => onPlusPathChange('trial')}
              style={[
                styles.plusPathCard,
                plusPath === 'trial' && { borderColor: colors.y, backgroundColor: colors.yl },
              ]}
              disabled={props.busy}
            >
              <View style={[styles.plusPathHeader, rowDir]}>
                <Text style={styles.plusPathIcon}>🎁</Text>
                <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
                  <Text style={[styles.plusPathTitle, dirStyle]}>
                    {ar
                      ? 'ابدأ بتجربة 14 يوم كمتجر عادي'
                      : 'Start 14-day trial as standard store'}
                  </Text>
                  <Text style={[styles.plusPathHint, dirStyle]}>
                    {ar
                      ? '⚠️ لن تحصل على مميزات Store Plus حتى تدفع لاحقاً من لوحة التحكم'
                      : '⚠️ You will not get Store Plus features until you upgrade later from your dashboard'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!isTrialPath ? (
        <View style={[styles.priceRow, rowDir]}>
          <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
            <Text style={[styles.priceLabel, dirStyle]}>{t.planCost}</Text>
          </View>
          <Text style={styles.priceValue}>
            {props.iosDisplayPrice ?? `${props.price} ${ar ? 'ج.م' : 'EGP'}`}{' '}
            <Text style={styles.priceUnit}>/{cycleUnit}</Text>
          </Text>
        </View>
      ) : null}

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'إلغاء' : 'Cancel'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={
              isTrialPath
                ? ar
                  ? 'ابدأ التجربة'
                  : 'Start Trial'
                : ar
                  ? 'التالي'
                  : 'Next'
            }
            variant="y"
            size="md"
            onPress={isTrialPath ? props.onTrialStart : props.onNext}
            disabled={props.busy}
          />
        </View>
      </View>
    </View>
  )
}

function PayMethodPanel(props: {
  price: number
  iosDisplayPrice?: string
  cycle: BillingCycle
  onCycleChange: (c: BillingCycle) => void
  showCyclePicker: boolean
  settings: SiteSettings | null
  walletBalance: number | null
  err: string
  busy: boolean
  hasBack: boolean
  isCreatingStore: boolean
  onBack: () => void
  onPickInstapay: () => void
  onPickMobileWallet: () => void
  onPickWallet: () => void
  onPickAppleIap: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { settings, walletBalance, price, cycle, onCycleChange, showCyclePicker } = props
  const instapayOn = settings?.instapayEnabled ?? false
  const mobileWalletOn = settings?.mobileWalletEnabled ?? false
  const walletShort = walletBalance != null && walletBalance < price
  const cycleUnit = cycle === 'yearly' ? t.yearlyBilling : t.monthlyBilling

  return (
    <View>
      <View style={colDir}>
        <Text style={[styles.stepHeading, dirStyle]}>{t.choosePaymentMethod}</Text>
      </View>

      {showCyclePicker ? (
        <View style={colDir}>
          <Text style={[styles.sectionLabel, dirStyle]}>{t.billingCycleLabel}</Text>
          <View style={styles.typeGrid}>
            <Pressable
              onPress={() => onCycleChange('monthly')}
              style={[
                styles.typeCard,
                cycle === 'monthly' && { borderColor: colors.y, backgroundColor: colors.yl },
              ]}
              disabled={props.busy}
            >
              <Text style={styles.typeIcon}>🗓️</Text>
              <Text style={styles.typeLabel}>{t.monthlyBilling}</Text>
            </Pressable>
            <Pressable
              onPress={() => onCycleChange('yearly')}
              style={[
                styles.typeCard,
                cycle === 'yearly' && { borderColor: colors.y, backgroundColor: colors.yl },
              ]}
              disabled={props.busy}
            >
              <Text style={styles.typeIcon}>📅</Text>
              <Text style={styles.typeLabel}>{t.yearlyBilling}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.priceRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.priceLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.priceValue}>
          {props.iosDisplayPrice ?? `${price} ${ar ? 'ج.م' : 'EGP'}`}{' '}
          <Text style={styles.priceUnit}>/{cycleUnit}</Text>
        </Text>
      </View>

      <View style={styles.methodList}>
        {IS_IOS ? (
          // App Store §3.1.1: iOS shows Apple IAP as the sole external-checkout
          // path for digital goods. InstaPay + mobile wallet are hidden here.
          <MethodCard
            icon="logo-apple"
            iconColor={colors.dk}
            title={ar ? 'الدفع عبر Apple' : 'Pay with Apple'}
            subtitle={ar ? 'App Store · اشتراك آمن' : 'App Store · Secure subscription'}
            onPress={props.onPickAppleIap}
            disabled={props.busy}
          />
        ) : (
          <>
            {instapayOn ? (
              <MethodCard
                icon="phone-portrait-outline"
                iconColor={'#7B2FBE'}
                title={t.payWithInstapay}
                subtitle={ar ? 'تحويل يدوي + إثبات' : 'Manual transfer + proof'}
                onPress={props.onPickInstapay}
                disabled={props.busy}
                gradientBg
              />
            ) : null}
            {mobileWalletOn ? (
              <MethodCard
                icon="phone-portrait-outline"
                iconColor={'#059669'}
                title={t.payWithMobileWallet}
                subtitle={ar ? 'تحويل يدوي + إثبات' : 'Manual transfer + proof'}
                onPress={props.onPickMobileWallet}
                disabled={props.busy}
                mobileWalletBg
              />
            ) : null}
            <MethodCard
              icon="wallet-outline"
              iconColor={colors.y}
              title={t.payWithWallet}
              subtitle={
                walletBalance != null
                  ? `${t.walletBalance}: ${walletBalance} ${ar ? 'ج.م' : 'EGP'}`
                  : t.walletBalance
              }
              onPress={props.onPickWallet}
              disabled={props.busy || walletShort}
              warn={walletShort ? t.insufficientBalance : undefined}
            />
          </>
        )}
      </View>

      <LegalLinks />

      <ErrorBox err={props.err} />

      {props.hasBack ? (
        <View style={[styles.actions, rowDir]}>
          <View style={{ flex: 1 }}>
            <Button
              label={ar ? 'رجوع' : 'Back'}
              variant="outline"
              size="md"
              onPress={props.onBack}
              disabled={props.busy}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

function MethodCard({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  disabled,
  warn,
  gradientBg,
  mobileWalletBg,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle: string
  onPress: () => void
  disabled?: boolean
  warn?: string
  gradientBg?: boolean
  mobileWalletBg?: boolean
}) {
  const { ar, rowDir, colDir, dirStyle } = useDir()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.methodCard,
        rowDir,
        gradientBg && { backgroundColor: '#F6EFFB', borderColor: '#D6BCEF' },
        mobileWalletBg && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
        pressed && !disabled && { opacity: 0.95, transform: [{ scale: 0.99 }] },
        disabled && { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
      ]}
    >
      <View style={[styles.methodIconWrap, { backgroundColor: colors.white }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
        <Text style={[styles.methodTitle, dirStyle]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.methodSubtitle, dirStyle]} numberOfLines={2}>{subtitle}</Text>
        {warn ? (
          <Text style={[styles.methodWarn, dirStyle]} numberOfLines={1}>{warn}</Text>
        ) : null}
      </View>
      <Ionicons
        name={ar ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={colors.g400}
      />
    </Pressable>
  )
}

function InstapayPanel(props: {
  settings: SiteSettings | null
  price: number
  screenshotKey: string
  onScreenshotChange: (v: string) => void
  buyerPhone: string
  onBuyerPhoneChange: (v: string) => void
  err: string
  busy: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { price } = props

  return (
    <View>
      <InstapayQrCard amount={price} />

      <View style={{ marginTop: spacing.md }}>
        <PaymentScreenshotUpload
          label={t.uploadScreenshot}
          value={props.screenshotKey}
          onChange={props.onScreenshotChange}
          aspect="wide"
          hint={t.screenshotRequired}
        />
      </View>

      <Input
        label={t.buyerPhone}
        value={props.buyerPhone}
        onChangeText={props.onBuyerPhoneChange}
        placeholder="01012345678"
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
        // Phone numbers render LTR regardless of UI locale.
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <View style={colDir}>
        <Text style={[styles.helpText, dirStyle, { marginTop: -spacing.sm }]}>
          {t.buyerPhoneHint}
        </Text>
      </View>

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={t.submitPayment}
            variant="y"
            size="md"
            onPress={props.onSubmit}
            loading={props.busy}
          />
        </View>
      </View>
    </View>
  )
}

function MobileWalletPanel(props: {
  settings: SiteSettings | null
  price: number
  screenshotKey: string
  onScreenshotChange: (v: string) => void
  buyerPhone: string
  onBuyerPhoneChange: (v: string) => void
  err: string
  busy: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { price, settings } = props

  return (
    <View>
      <MobileWalletCard
        amount={price}
        walletNumber={settings?.mobileWalletAccount ?? ''}
        walletName={settings?.mobileWalletName ?? null}
      />

      <View style={{ marginTop: spacing.md }}>
        <PaymentScreenshotUpload
          label={t.uploadScreenshot}
          value={props.screenshotKey}
          onChange={props.onScreenshotChange}
          aspect="wide"
          hint={t.screenshotRequired}
        />
      </View>

      <Input
        label={t.buyerPhone}
        value={props.buyerPhone}
        onChangeText={props.onBuyerPhoneChange}
        placeholder="01012345678"
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <View style={colDir}>
        <Text style={[styles.helpText, dirStyle, { marginTop: -spacing.sm }]}>
          {t.buyerPhoneHint}
        </Text>
      </View>

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={t.submitPayment}
            variant="y"
            size="md"
            onPress={props.onSubmit}
            loading={props.busy}
          />
        </View>
      </View>
    </View>
  )
}

function WalletPanel(props: {
  price: number
  iosDisplayPrice?: string
  walletBalance: number | null
  err: string
  busy: boolean
  onBack: () => void
  onPay: () => void
}) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { price, walletBalance } = props
  const short = walletBalance != null && walletBalance < price

  return (
    <View>
      <View style={[styles.walletBanner, rowDir]}>
        <Ionicons name="wallet" size={24} color={colors.y} />
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.walletBannerLabel, dirStyle]}>{t.walletBalance}</Text>
          <Text style={[styles.walletBannerValue, dirStyle]}>
            {walletBalance ?? 0} {ar ? 'ج.م' : 'EGP'}
          </Text>
        </View>
      </View>

      <View style={[styles.detailRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.detailLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.detailValue}>
          {props.iosDisplayPrice ?? `${price} ${ar ? 'ج.م' : 'EGP'}`}
        </Text>
      </View>

      {short ? (
        <View style={[styles.errorBox, rowDir, { marginTop: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
          <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
            <Text style={[styles.errorText, dirStyle]}>{t.insufficientBalance}</Text>
          </View>
        </View>
      ) : null}

      <ErrorBox err={props.err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={props.onBack}
            disabled={props.busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={t.payWithWallet}
            variant="y"
            size="md"
            onPress={props.onPay}
            loading={props.busy}
            disabled={short}
          />
        </View>
      </View>
    </View>
  )
}

function AppleIapPanel({ err }: { err: string }) {
  const { ar, colDir, dirStyle } = useDir()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.dk} />
      <View style={[colDir, { marginTop: spacing.md, alignSelf: 'stretch' }]}>
        <Text style={[styles.stepHeading, dirStyle, { textAlign: 'center' }]}>
          {ar ? 'جارٍ الاتصال بـ App Store...' : 'Connecting to App Store...'}
        </Text>
        <Text style={[styles.helpText, dirStyle, { textAlign: 'center' }]}>
          {ar ? 'أكمل عملية الشراء في نافذة Apple' : 'Complete the purchase in the Apple dialog'}
        </Text>
      </View>
      <ErrorBox err={err} />
      <LegalLinks />
    </View>
  )
}

// App Store §3.1.2(c): the subscription purchase flow must expose functional
// links to the Terms of Use (EULA) and Privacy Policy. Rendered on the pay-
// method step and on the Apple IAP confirmation step so a reviewer can reach
// them from any surface that leads to a subscription purchase.
function LegalLinks() {
  const { ar, rowDir } = useDir()
  const termsLabel = ar ? 'شروط الاستخدام' : 'Terms of Use (EULA)'
  const privacyLabel = ar ? 'سياسة الخصوصية' : 'Privacy Policy'
  return (
    <View style={[styles.legalLinks, rowDir]}>
      <Pressable
        onPress={() => router.push('/terms')}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={termsLabel}
      >
        <Text style={styles.legalLink}>{termsLabel}</Text>
      </Pressable>
      <Text style={styles.legalDot}> · </Text>
      <Pressable
        onPress={() => router.push('/privacy')}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={privacyLabel}
      >
        <Text style={styles.legalLink}>{privacyLabel}</Text>
      </Pressable>
    </View>
  )
}

function DonePanel({
  title,
  body,
  onClose,
  ctaLabel,
}: {
  title: string
  body: string
  onClose: () => void
  ctaLabel: string
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View style={styles.successCircle}>
        <Ionicons name="checkmark" size={40} color={colors.white} />
      </View>
      <Text style={[styles.stepHeading, { marginTop: spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[styles.helpText, { textAlign: 'center', marginTop: spacing.sm }]}>{body}</Text>
      <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
        <Button label={ctaLabel} variant="y" size="md" onPress={onClose} />
      </View>
    </View>
  )
}

function CancelStorePanel({
  err,
  busy,
  confirmText,
  onCancel,
  onConfirm,
}: {
  err: string
  busy: boolean
  confirmText: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { ar, rowDir, colDir, dirStyle } = useDir()
  function ask() {
    Alert.alert(
      ar ? 'تأكيد الإلغاء' : 'Confirm cancellation',
      confirmText,
      [
        { text: ar ? 'رجوع' : 'Back', style: 'cancel' },
        { text: ar ? 'تأكيد' : 'Confirm', style: 'destructive', onPress: onConfirm },
      ],
      { cancelable: true },
    )
  }
  return (
    <View>
      <View style={[styles.warningBox, rowDir]}>
        <Ionicons name="warning-outline" size={22} color={colors.red} />
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.warningText, dirStyle]}>{confirmText}</Text>
        </View>
      </View>
      <ErrorBox err={err} />
      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={onCancel}
            disabled={busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={ar ? 'تأكيد الإلغاء' : 'Confirm cancel'}
            variant="red"
            size="md"
            onPress={ask}
            loading={busy}
          />
        </View>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    ...shadow.sl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dk,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetTitle: {
    flexShrink: 1,
    marginEnd: spacing.sm,
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
  },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  stepHeading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  typeIcon: {
    fontSize: 22,
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
    textAlign: 'center',
  },
  typeSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    textAlign: 'center',
  },
  plusPathList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  plusPathCard: {
    borderWidth: 2,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  plusPathHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  plusPathIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  plusPathTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: 2,
  },
  plusPathHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.g100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  priceValue: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
  },
  priceUnit: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  methodList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
    ...shadow.ss,
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.g200,
  },
  methodTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  methodSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    marginTop: 2,
  },
  methodWarn: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.red,
    marginTop: 4,
  },
  instapayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#F6EFFB',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  instapayBannerText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#7B2FBE',
  },
  walletBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.yl,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  walletBannerLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
  },
  walletBannerValue: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  detailLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  helpText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  legalLinks: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  legalLink: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.dk,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.rl,
    borderColor: colors.red,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.red,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.rl,
    borderColor: colors.red,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
})
