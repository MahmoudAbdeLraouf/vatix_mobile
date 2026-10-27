import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { AUTH_ERR, authErrorMessage, authFetch, authPost, updateStoredUser } from '@/lib/auth'
import {
  getSiteSettings,
  getSubscriptionPlans,
  PlanData,
  SiteSettings,
  UserProfile,
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
  SKU_SUBSCRIPTION_STORE,
} from '@/lib/iap-products'
import { finalizePaymentSuccess, verifyIapPurchase } from '@/lib/payment'

// Mirrors vatix_website/components/upgrade-modal.tsx
// Two modes × multi-step flow:
//   Mode: upgrade-to-store | cancel-store
//   Step: store-info → pay-method → instapay → instapay-done
//         pay-method → mobile-wallet → mobile-wallet-done
//         pay-method → wallet → wallet-done
// A user who already has a store profile skips store-info (renewal).
// Store materialization is deferred: store metadata is sent inside payment
// `metadata` so the backend creates the profile only after admin approval
// (InstaPay / mobile-wallet) or immediately (wallet).

export type UpgradeMode = 'upgrade-to-store' | 'cancel-store'
export type CancelReason =
  | 'expensive'
  | 'no_lead'
  | 'wrong_account'
  | 'no_need'
  | 'need_feature'
  | 'other'
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

interface Props {
  visible: boolean
  mode: UpgradeMode
  onClose: () => void
  onSuccess?: () => void
}

// Store subscriptions are monthly-only.
const STORE_PLAN = { code: 'subscription_store', fallbackPrice: 450 }
// Substring of the backend's "trial already used" rejection from
// POST /user/upgrade-to-store (users.service.ts upgradeToStore).
const TRIAL_USED_MARKER = 'استخدمت تجربتك المجانية'

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

export function UpgradeModal({ visible, mode, onClose, onSuccess }: Props) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { t } = useLocale()
  const { ar, rowDir } = useDir()
  const insets = useSafeAreaInsets()
  const { user, refetchUser } = useAuth()

  // A client tapping "Upgrade to store" has no storeProfile yet, so they must
  // still run store-info before payment. Only skip that step when the user is
  // already a store (renewing).
  const hasStoreAlready = user?.type === 'store'
  const needsStoreCreation = mode !== 'cancel-store' && !hasStoreAlready

  const [step, setStep] = useState<Step>(
    needsStoreCreation ? 'store-info' : 'pay-method',
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Clients who already used their free trial must pay to become a store, so
  // store-info continues to pay-method instead of starting a trial.
  const [trialUsed, setTrialUsed] = useState(false)

  // Cancellation reason capture (mirrors website upgrade-modal).
  // Two-step in-modal flow: pick reason → confirm. Native Alert would push it
  // to three taps and put the confirm outside the sheet, so we keep it inline.
  const [cancelSubStep, setCancelSubStep] = useState<'reason' | 'confirm'>('reason')
  const [cancelReason, setCancelReason] = useState<CancelReason | ''>('')
  const [cancelDetail, setCancelDetail] = useState('')

  // Mount-time data
  const [plans, setPlans] = useState<PlanData[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  // StoreKit-formatted prices keyed by SKU. iOS-only; empty on Android/web.
  // Sourced from App Store Connect so Apple's 30% commission gross-up is
  // reflected without duplicating the pricing table in the client.
  const [iosPriceMap, setIosPriceMap] = useState<Record<string, string>>({})

  // Store-info form
  const [storeName, setStoreName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [cover, setCover] = useState('')

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
    setCancelSubStep('reason')
    setCancelReason('')
    setCancelDetail('')
  }, [visible, mode, needsStoreCreation])

  // Load plans + settings + wallet on open
  useEffect(() => {
    if (!visible) return
    let live = true
    ;(async () => {
      const [p, s, w, profile] = await Promise.all([
        getSubscriptionPlans().catch(() => [] as PlanData[]),
        getSiteSettings().catch(() => null),
        // Wallet balance is peripheral: user can still pick InstaPay / mobile
        // wallet / IAP if this fails. Failing loudly here would take down the
        // whole modal.
        authFetch<WalletBalance>('/payments/wallet/balance').catch(() => null),
        // If this fails we still offer the trial; handleTrialSignup falls
        // back to payment when the backend rejects it.
        needsStoreCreation
          ? authFetch<UserProfile>('/user/profile').catch(() => null)
          : Promise.resolve(null),
      ])
      if (!live) return
      setPlans(p)
      setSettings(s)
      setWallet(w)
      setTrialUsed(profile?.trialUsed === true)
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

  // Selected plan amount for pay-method / instapay / wallet steps. Falls back
  // to STORE_PLAN.fallbackPrice when the plan row is missing.
  const selectedPlan = useMemo(() => {
    const priceStr = plans.find(
      p => p.storeType === 'store' && (p.billingCycle ?? 'monthly') === 'monthly',
    )?.price
    const priceNum = priceStr != null ? Number(priceStr) : STORE_PLAN.fallbackPrice
    return {
      code: STORE_PLAN.code,
      amount: Number.isFinite(priceNum) ? priceNum : STORE_PLAN.fallbackPrice,
    }
  }, [plans])

  const walletBalance = wallet?.balance ?? null

  // On iOS, prefer the StoreKit-formatted price. Falls back to the grossed-up
  // App Store Connect tier when StoreKit is unreachable (Expo Go, dev, offline)
  // so the UI never shows the pre-commission backend price on an iOS build.
  const iosDisplayPrice = IS_IOS
    ? (iosPriceMap[SKU_SUBSCRIPTION_STORE] ??
      iosFallbackDisplayPrice(SKU_SUBSCRIPTION_STORE))
    : undefined

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleCancelStore() {
    // Mirror website contract: reason is mandatory; `need_feature`/`other`
    // require a ≥2-char explanation. Backend re-validates via class-validator,
    // but blocking here avoids a round-trip and keeps the sheet stable.
    if (!cancelReason) {
      setErr(t.cancelReasonRequired)
      setCancelSubStep('reason')
      return
    }
    const detailTrimmed = cancelDetail.trim()
    const needsDetail = cancelReason === 'need_feature' || cancelReason === 'other'
    if (needsDetail && detailTrimmed.length < 2) {
      setErr(t.cancelReasonDetailRequired)
      setCancelSubStep('reason')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/user/cancel-store', {
        reason: cancelReason,
        detail: needsDetail ? detailTrimmed : (detailTrimmed || undefined),
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

  // Materialize a store profile on the 14-day trial without any payment.
  // When the trial is already used, go to payment instead; the store is then
  // created from buildStoreMetadata() once the payment succeeds.
  async function handleTrialSignup() {
    if (!storeName.trim()) {
      setErr(ar ? 'اسم المتجر مطلوب' : 'Store name is required')
      return
    }
    if (!logo) {
      setErr(ar ? 'شعار المتجر مطلوب' : 'Store logo is required')
      return
    }
    if (trialUsed) {
      setErr('')
      setStep('pay-method')
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
      // Older backends don't send `trialUsed` on /user/profile, so detect the
      // trial-used rejection and continue to payment with the same store info.
      if (e instanceof Error && e.message.includes(TRIAL_USED_MARKER)) {
        setTrialUsed(true)
        setErr('')
        setStep('pay-method')
        return
      }
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
      storeType: 'store',
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
    if (needsStoreCreation && !logo) {
      setErr(ar ? 'شعار المتجر مطلوب' : 'Store logo is required')
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
        billingCycle: 'monthly',
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
    if (needsStoreCreation && !logo) {
      setErr(ar ? 'شعار المتجر مطلوب' : 'Store logo is required')
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
        billingCycle: 'monthly',
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
    if (needsStoreCreation && !logo) {
      setErr(ar ? 'شعار المتجر مطلوب' : 'Store logo is required')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await authPost<{ user?: unknown }>('/payments/wallet/pay', {
        type: selectedPlan.code,
        billingCycle: 'monthly',
        metadata: buildStoreMetadata(),
      })
      await updateStoredUser((res as { user?: Parameters<typeof updateStoredUser>[0] })?.user ?? null)
      await refetchUser()
      // Post-pay balance refresh is best-effort — the payment already
      // succeeded, so surfacing a fetch error here would mislead the user.
      const fresh = await authFetch<WalletBalance>('/payments/wallet/balance').catch(() => null)
      if (fresh) setWallet(fresh)
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
    if (needsStoreCreation && !logo) {
      setErr(ar ? 'شعار المتجر مطلوب' : 'Store logo is required')
      return
    }
    const sku = SKU_SUBSCRIPTION_STORE
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
      // Capture StoreKit's price so we can echo the exact amount the buyer was
      // charged (999 EGP tier) back to the backend; otherwise Payment.amount is
      // recorded from SubscriptionPlan.price (750 EGP net-proceeds) and history
      // shows a lower figure than what appeared at Apple's confirmation sheet.
      const skProduct = await requireIosProduct(sku, product.type)
      const customerPrice =
        typeof skProduct.price === 'number' ? skProduct.price : undefined
      const customerCurrency = skProduct.currency || 'EGP'

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
        metadata: {
          ...buildStoreMetadata(),
          billingCycle: 'monthly',
          ...(customerPrice !== undefined && { customerPrice }),
          customerCurrency,
        },
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
  const priceLabel = iosDisplayPrice
    ? iosDisplayPrice
    : `${selectedPlan.amount} ${currencyLabel} / ${t.monthlyBilling}`
  const title =
    mode === 'cancel-store'
      ? t.cancelStore
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
                  subStep={cancelSubStep}
                  onSubStepChange={setCancelSubStep}
                  reason={cancelReason}
                  onReasonChange={setCancelReason}
                  detail={cancelDetail}
                  onDetailChange={setCancelDetail}
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
                  err={err}
                  busy={busy}
                  trialUsed={trialUsed}
                  onBack={onClose}
                  onSubmit={handleTrialSignup}
                />
              ) : step === 'pay-method' ? (
                <PayMethodPanel
                  price={selectedPlan.amount}
                  iosDisplayPrice={iosDisplayPrice}
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
  const styles = useStyles()
  const { colors } = useTheme()
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
  err: string
  busy: boolean
  trialUsed: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  const styles = useStyles()
  const { storeName, onStoreNameChange } = props
  const { t } = useLocale()
  const { ar, rowDir } = useDir()

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
        label={`${t.storeLogo} *`}
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
              props.trialUsed
                ? (ar ? 'متابعة للدفع ←' : 'Continue to payment →')
                : (ar ? 'ابدأ التجربة ←' : 'Start Trial →')
            }
            variant="y"
            size="md"
            onPress={props.onSubmit}
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
  const styles = useStyles()
  const { colors, isDark } = useTheme()
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { settings, walletBalance, price } = props
  const instapayOn = settings?.instapayEnabled ?? false
  const mobileWalletOn = settings?.mobileWalletEnabled ?? false
  const walletShort = walletBalance != null && walletBalance < price

  return (
    <View>
      <View style={colDir}>
        <Text style={[styles.stepHeading, dirStyle]}>{t.choosePaymentMethod}</Text>
      </View>

      <View style={[styles.priceRow, rowDir]}>
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.priceLabel, dirStyle]}>{t.planCost}</Text>
        </View>
        <Text style={styles.priceValue}>
          {props.iosDisplayPrice ?? `${price} ${ar ? 'ج.م' : 'EGP'}`}{' '}
          <Text style={styles.priceUnit}>/{t.monthlyBilling}</Text>
        </Text>
      </View>

      <View style={styles.methodList}>
        {IS_IOS ? (
          // App Store §3.1.1: iOS shows Apple IAP as the sole external-checkout
          // path for digital goods. InstaPay + mobile wallet are hidden here.
          <MethodCard
            icon="logo-apple"
            iconColor={isDark ? colors.y : colors.dk}
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
  const styles = useStyles()
  const { colors, isDark } = useTheme()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.methodCard,
        rowDir,
        gradientBg && (isDark
          ? { backgroundColor: 'rgba(123,47,190,0.16)', borderColor: 'rgba(168,110,224,0.45)' }
          : { backgroundColor: '#F6EFFB', borderColor: '#D6BCEF' }),
        mobileWalletBg && (isDark
          ? { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: 'rgba(16,185,129,0.45)' }
          : { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }),
        pressed && !disabled && { opacity: 0.95, transform: [{ scale: 0.99 }] },
        disabled && { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
      ]}
    >
      <View style={[styles.methodIconWrap, { backgroundColor: colors.card }]}>
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
        color={colors.subtle}
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
  const styles = useStyles()
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
          context="subscription-instapay"
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
  const styles = useStyles()
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
          context="subscription-mobile-wallet"
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
  const styles = useStyles()
  const { colors } = useTheme()
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
  const styles = useStyles()
  const { colors, isDark } = useTheme()
  const { ar, colDir, dirStyle } = useDir()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <ActivityIndicator size="large" color={isDark ? colors.y : colors.dk} />
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
  const styles = useStyles()
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
  const styles = useStyles()
  const { colors } = useTheme()
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

// Two-step cancellation flow mirroring `vatix_website/components/upgrade-modal.tsx`.
// Step 1 (`reason`) forces the user to name a churn cause before the friction
// warning; step 2 (`confirm`) is the existing red warning + destructive CTA.
// We used to show a native `Alert.alert` for confirmation, but that pushed the
// flow to three taps and hid the sheet — inline sub-steps keep both the reason
// summary and the warning visible on the same surface.
function CancelStorePanel({
  err,
  busy,
  confirmText,
  onCancel,
  onConfirm,
  subStep,
  onSubStepChange,
  reason,
  onReasonChange,
  detail,
  onDetailChange,
}: {
  err: string
  busy: boolean
  confirmText: string
  onCancel: () => void
  onConfirm: () => void
  subStep: 'reason' | 'confirm'
  onSubStepChange: (v: 'reason' | 'confirm') => void
  reason: CancelReason | ''
  onReasonChange: (v: CancelReason) => void
  detail: string
  onDetailChange: (v: string) => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { t } = useLocale()

  // Match the website contract: only `need_feature` and `other` require the
  // free-text field. Backend re-validates via class-validator `@ValidateIf`.
  const needsDetail = reason === 'need_feature' || reason === 'other'
  const detailTrimmed = detail.trim()
  const reasonValid = !!reason && (!needsDetail || detailTrimmed.length >= 2)

  const reasonOptions: { key: CancelReason; label: string; icon: string }[] = [
    { key: 'expensive', label: t.cancelReasonExpensive, icon: '💸' },
    { key: 'no_lead', label: t.cancelReasonNoLead, icon: '📉' },
    { key: 'wrong_account', label: t.cancelReasonWrongAccount, icon: '🔀' },
    { key: 'no_need', label: t.cancelReasonNoNeed, icon: '⏸️' },
    { key: 'need_feature', label: t.cancelReasonNeedFeature, icon: '✨' },
    { key: 'other', label: t.cancelReasonOther, icon: '📝' },
  ]

  if (subStep === 'reason') {
    return (
      <View>
        <View style={colDir}>
          <Text style={[styles.stepHeading, dirStyle]}>{t.cancelReasonPrompt}</Text>
        </View>
        <View style={colDir}>
          <View style={styles.reasonGrid}>
            {reasonOptions.map(opt => {
              const active = reason === opt.key
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onReasonChange(opt.key)}
                  style={[
                    styles.typeCard,
                    styles.reasonCard,
                    active && { borderColor: colors.y, backgroundColor: colors.yellowBg },
                  ]}
                  disabled={busy}
                >
                  <Text style={styles.typeIcon}>{opt.icon}</Text>
                  <Text style={styles.typeLabel}>{opt.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {needsDetail ? (
          <Input
            label={
              reason === 'need_feature'
                ? t.cancelReasonNeedFeatureDetail
                : t.cancelReasonOtherDetail
            }
            value={detail}
            onChangeText={onDetailChange}
            placeholder={
              reason === 'need_feature'
                ? t.cancelReasonNeedFeatureDetail
                : t.cancelReasonOtherDetail
            }
            multiline
            numberOfLines={3}
            maxLength={500}
            style={{ height: 84, textAlignVertical: 'top', paddingTop: 12 }}
          />
        ) : null}

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
              label={t.cancelReasonNext}
              variant="y"
              size="md"
              onPress={() => onSubStepChange('confirm')}
              disabled={busy || !reasonValid}
            />
          </View>
        </View>
      </View>
    )
  }

  // Confirm sub-step: reuse the existing red warning and add a compact summary
  // card so the user can see (and mentally re-confirm) the reason they picked
  // before the destructive tap. Back returns to the reason picker rather than
  // closing the sheet — matches the website's Back-to-reason behavior.
  const selectedReasonLabel =
    reasonOptions.find(o => o.key === reason)?.label ?? ''
  return (
    <View>
      <View style={[styles.warningBox, rowDir]}>
        <Ionicons name="warning-outline" size={22} color={colors.red} />
        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
          <Text style={[styles.warningText, dirStyle]}>{confirmText}</Text>
        </View>
      </View>

      <View style={[styles.reasonSummary, colDir]}>
        <Text style={[styles.reasonSummaryLabel, dirStyle]}>
          {t.cancelReasonSummaryLabel}
        </Text>
        <Text style={[styles.reasonSummaryValue, dirStyle]}>{selectedReasonLabel}</Text>
        {needsDetail && detailTrimmed ? (
          <Text style={[styles.reasonSummaryDetail, dirStyle]}>{detailTrimmed}</Text>
        ) : null}
      </View>

      <ErrorBox err={err} />

      <View style={[styles.actions, rowDir]}>
        <View style={{ flex: 1 }}>
          <Button
            label={ar ? 'رجوع' : 'Back'}
            variant="outline"
            size="md"
            onPress={() => onSubStepChange('reason')}
            disabled={busy}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={ar ? 'تأكيد الإلغاء' : 'Confirm cancel'}
            variant="red"
            size="md"
            onPress={onConfirm}
            loading={busy}
          />
        </View>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors, dark = false) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    ...shadow.sl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.hero,
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
    color: colors.heading,
    marginBottom: spacing.xs,
  },
  stepHeading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.heading,
    marginBottom: spacing.md,
  },
  typeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  // 2-column wrap grid for the 6 cancellation reasons. A strict row would
  // squeeze the 6 cards into unreadable slivers, so this wraps at
  // `flexBasis: 48%` (leaves room for the `spacing.sm` gap).
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reasonCard: {
    flexBasis: '48%',
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 76,
    justifyContent: 'center',
  },
  reasonSummary: {
    backgroundColor: colors.placeholder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reasonSummaryLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  reasonSummaryValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
  },
  reasonSummaryDetail: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  typeIcon: {
    fontSize: 22,
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.heading,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.placeholder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.muted,
  },
  priceValue: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.heading,
  },
  priceUnit: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
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
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...(dark ? null : shadow.ss),
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
  },
  methodSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
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
    backgroundColor: dark ? 'rgba(123,47,190,0.16)' : '#F6EFFB',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  instapayBannerText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: dark ? '#C89BEF' : '#7B2FBE',
  },
  walletBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.yellowBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  walletBannerLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.muted,
  },
  walletBannerValue: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.heading,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.muted,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
  },
  helpText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
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
    color: colors.heading,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
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
    backgroundColor: colors.redBg,
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
    backgroundColor: colors.redBg,
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

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
