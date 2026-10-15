import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  SiteSettings,
  StorePromotionOffer,
  UserProfile,
  WalletBalance,
  getSiteSettings,
  getStorePromotionOffer,
} from '@/lib/api'
import { authFetch, authPost, authErrorMessage, updateStoredUser, AUTH_ERR } from '@/lib/auth'
import { finalizePaymentSuccess, verifyIapPurchase } from '@/lib/payment'
import { IS_IOS } from '@/lib/platform'
import {
  fetchIosProducts,
  initIap,
  endIap,
  requireIosProduct,
  requestIosPurchase,
  getIosJws,
  finishIosPurchase,
  addPurchaseUpdatedListener,
  addPurchaseErrorListener,
} from '@/lib/iap'
import type { EventSubscription, Purchase, PurchaseError } from 'react-native-iap'
import { storePromotionIapProduct } from '@/lib/iap-products'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'

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
  }
}

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

type Step =
  | 'method'
  | 'instapay'
  | 'instapay-done'
  | 'mobile-wallet'
  | 'mobile-wallet-done'
  | 'wallet'
  | 'wallet-done'
  | 'apple-iap'
  | 'apple-iap-done'

export default function PromoteStoreScreen() {
  const { t, locale } = useLocale()
  const { user, refetchUser } = useAuth()
  const { ar, rowDir, colDir, dirStyle } = useDir()

  const isStoreUser = (user?.type ?? '').toLowerCase() === 'store'
  const blocked = user != null && !isStoreUser

  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [offer, setOffer] = useState<StorePromotionOffer | null>(null)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  // undefined = status unknown (fetch failed), null = not promoted, string = ISO date.
  const [promotedUntil, setPromotedUntil] = useState<string | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('method')
  const [iosPrice, setIosPrice] = useState<string | null>(null)
  const [screenshotKey, setScreenshotKey] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    ;(async () => {
      try {
        // The offer is the primary data: let a failure surface as an error
        // state with retry instead of rendering a made-up price.
        const [o, s, w, profile] = await Promise.all([
          getStorePromotionOffer(),
          getSiteSettings().catch(() => null),
          authFetch<WalletBalance>('/payments/wallet/balance').catch(() => null),
          authFetch<UserProfile>('/user/profile').catch(() => null),
        ])
        if (cancelled) return
        setOffer(o)
        setSettings(s)
        setWallet(w)
        setPromotedUntil(profile ? (profile.storeProfile?.promotedUntil ?? null) : undefined)

        if (IS_IOS && o.appleProductId) {
          const products = await fetchIosProducts([o.appleProductId], 'in-app').catch(() => [])
          if (cancelled) return
          const match = (products as Array<{ id: string; displayPrice?: string }>).find(
            (p) => p?.id === o.appleProductId,
          )
          setIosPrice(match?.displayPrice ?? null)
        }
      } catch {
        if (!cancelled) setLoadFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [blocked, reloadKey])

  const isPromoted = promotedUntil != null && Date.parse(promotedUntil) > Date.now()

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function offerSummary(o: StorePromotionOffer): string {
    if (IS_IOS) {
      return `${iosPrice ?? `${o.price} EGP`} · ${o.days} ${ar ? 'أيام' : 'days'}`
    }
    return t.promoteStore.offerSummary
      .replace('{price}', String(o.price))
      .replace('{days}', String(o.days))
  }

  async function refreshAfterPurchase(): Promise<void> {
    const profile = await finalizePaymentSuccess()
    if (profile) {
      await updateStoredUser(profile)
      setPromotedUntil(profile.storeProfile?.promotedUntil ?? null)
    }
    await refetchUser()
  }

  // Translate the backend's English 403s for the Arabic-first UI.
  function paymentErrorMessage(err: unknown): string {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Only stores can promote')) return t.promoteStore.storesOnly
    if (msg.includes('Renew your subscription')) return t.promoteStore.renewFirst
    return authErrorMessage(err, t) || t.buySlots.paymentFailed
  }

  function resetForm() {
    setSubmitError(null)
    setStep('method')
  }

  async function handleWalletPayment() {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const res = await authPost<{
        status: string
        newBalance: number
        promotedUntil?: string | null
      }>('/payments/store-promotion/wallet', {})
      setWallet((prev) => (prev
        ? { ...prev, balance: res.newBalance }
        : { balance: res.newBalance, totalToppedUp: 0, totalSpent: 0 }))
      if (res.promotedUntil) setPromotedUntil(res.promotedUntil)
      await refreshAfterPurchase().catch(() => undefined)
      setStep('wallet-done')
    } catch (err) {
      setSubmitError(paymentErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReceipt(path: 'instapay' | 'mobile-wallet') {
    if (!screenshotKey) {
      setSubmitError(t.buySlots.missingScreenshot)
      return
    }
    if (!buyerPhone.trim()) {
      setSubmitError(t.buySlots.missingPhone)
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      await authPost(`/payments/store-promotion/${path}`, {
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
      })
      setStep(path === 'instapay' ? 'instapay-done' : 'mobile-wallet-done')
    } catch (err) {
      setSubmitError(paymentErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAppleIapPurchase() {
    const sku = offer?.appleProductId
    if (!sku) {
      setSubmitError(authErrorMessage(new Error(AUTH_ERR.IAP_PRODUCT_UNAVAILABLE), t))
      return
    }
    const product = storePromotionIapProduct(sku)
    setSubmitError(null)
    setStep('apple-iap')
    setSubmitting(true)
    const subs: { updated: EventSubscription | null; error: EventSubscription | null } = {
      updated: null,
      error: null,
    }
    let cancelled = false
    try {
      await initIap()
      const skProduct = await requireIosProduct(sku, product.type)
      const customerPrice = typeof skProduct.price === 'number' ? skProduct.price : undefined
      const customerCurrency = skProduct.currency || 'EGP'
      const purchase = await new Promise<Purchase>((resolve, reject) => {
        subs.updated = addPurchaseUpdatedListener((p) => {
          if (p.productId === sku) resolve(p)
        })
        subs.error = addPurchaseErrorListener((e: PurchaseError) => {
          if (e.code === 'user-cancelled' || /cancel/i.test(e.message ?? '')) {
            cancelled = true
            reject(new Error('__CANCELLED__'))
            return
          }
          if (e.code === 'sku-not-found') {
            reject(new Error(AUTH_ERR.IAP_PRODUCT_UNAVAILABLE))
            return
          }
          reject(new Error(e.message || 'Purchase failed'))
        })
        requestIosPurchase(sku, product.type).catch(reject)
      })
      const jws = await getIosJws(purchase)
      if (!jws) throw new Error(ar ? 'تعذر التحقق من العملية' : 'Could not verify transaction')
      // The backend recognises the promotion by the transaction's productId
      // (storePromotionAppleProductId), so no extra metadata id is needed.
      await verifyIapPurchase({
        signedTransaction: jws,
        metadata: {
          ...(customerPrice !== undefined && { customerPrice }),
          customerCurrency,
        },
      })
      await finishIosPurchase(purchase, product.isConsumable)
      await refreshAfterPurchase().catch(() => undefined)
      setStep('apple-iap-done')
    } catch (e: unknown) {
      if (!cancelled) {
        setSubmitError(paymentErrorMessage(e))
      }
      setStep('method')
    } finally {
      subs.updated?.remove()
      subs.error?.remove()
      await endIap()
      setSubmitting(false)
    }
  }

  const doneBack = (
    <View style={styles.doneCtaRow}>
      <Button
        label={t.promoteStore.backToDashboard}
        variant="primary"
        onPress={() => router.replace('/(tabs)/dashboard')}
      />
    </View>
  )

  const newDateRow =
    isPromoted && promotedUntil ? (
      <View style={[styles.doneStatRow, rowDir]}>
        <Text style={[styles.doneStatLabel, dirStyle]}>{t.promoteStore.promotedUntilLabel}</Text>
        <Text style={[styles.doneStatValue, dirStyle]}>{formatDate(promotedUntil)}</Text>
      </View>
    ) : null

  function renderBody() {
    if (blocked) {
      return (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, dirStyle]}>{t.promoteStore.storesOnly}</Text>
        </View>
      )
    }
    if (loading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.dk} />
          <Text style={[styles.loadingText, dirStyle]}>{t.buySlots.loading}</Text>
        </View>
      )
    }
    if (loadFailed || !offer) {
      return (
        <View style={styles.methodBlock}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{t.promoteStore.loadError}</Text>
          </View>
          <Button
            label={t.promoteStore.retry}
            variant="outline"
            onPress={() => setReloadKey((k) => k + 1)}
            fullWidth
          />
        </View>
      )
    }

    switch (step) {
      case 'method':
        return (
          <>
            <View style={[styles.statusBox, colDir]}>
              {promotedUntil !== undefined ? (
                <Text style={[styles.statusText, isPromoted && styles.statusTextOn, dirStyle]}>
                  {isPromoted && promotedUntil
                    ? t.promoteStore.activeUntil.replace('{date}', formatDate(promotedUntil))
                    : t.promoteStore.notPromoted}
                </Text>
              ) : null}
              <Text style={[styles.summaryValue, dirStyle]}>{offerSummary(offer)}</Text>
            </View>
            <MethodStep
              offer={offer}
              settings={settings}
              wallet={wallet}
              submitError={submitError}
              isPromoted={isPromoted}
              onPickWallet={() => {
                setSubmitError(null)
                setStep('wallet')
              }}
              onPickInstapay={() => {
                setSubmitError(null)
                setStep('instapay')
              }}
              onPickMobileWallet={() => {
                setSubmitError(null)
                setStep('mobile-wallet')
              }}
              onPickApple={handleAppleIapPurchase}
            />
          </>
        )
      case 'apple-iap':
        return (
          <AppleIapPanel
            summary={offerSummary(offer)}
            submitting={submitting}
            submitError={submitError}
            onBack={resetForm}
          />
        )
      case 'wallet':
        return (
          <WalletStep
            offer={offer}
            wallet={wallet}
            submitting={submitting}
            submitError={submitError}
            onBack={resetForm}
            onPay={handleWalletPayment}
          />
        )
      case 'instapay':
      case 'mobile-wallet':
        return (
          <ReceiptStep
            kind={step}
            offer={offer}
            settings={settings}
            screenshotKey={screenshotKey}
            setScreenshotKey={setScreenshotKey}
            buyerPhone={buyerPhone}
            setBuyerPhone={setBuyerPhone}
            submitting={submitting}
            submitError={submitError}
            onBack={resetForm}
            onSubmit={() => submitReceipt(step)}
          />
        )
      case 'wallet-done':
        return (
          <View style={styles.donePanel}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, dirStyle]}>{t.buySlots.paymentSuccessTitle}</Text>
            <Text style={[styles.doneBody, dirStyle]}>{t.promoteStore.walletDeductedBody}</Text>
            {newDateRow}
            <View style={[styles.doneStatRow, rowDir]}>
              <Text style={[styles.doneStatLabel, dirStyle]}>{t.buySlots.remainingWalletBalance}</Text>
              <Text style={[styles.doneStatValue, dirStyle]}>
                {wallet !== null ? Number(wallet.balance).toFixed(2) : '…'} {ar ? 'ج.م' : 'EGP'}
              </Text>
            </View>
            {doneBack}
          </View>
        )
      case 'apple-iap-done':
        return (
          <View style={styles.donePanel}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, dirStyle]}>{t.buySlots.paymentSuccessTitle}</Text>
            <Text style={[styles.doneBody, dirStyle]}>{t.promoteStore.appleSuccessBody}</Text>
            {newDateRow}
            {doneBack}
          </View>
        )
      case 'instapay-done':
      case 'mobile-wallet-done':
        return (
          <View style={styles.donePanel}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, dirStyle]}>{t.buySlots.requestReceivedTitle}</Text>
            <Text style={[styles.doneBody, dirStyle]}>{t.promoteStore.withinHours}</Text>
            {doneBack}
          </View>
        )
    }
  }

  return (
    <DashboardLayout title={t.promoteStoreNav}>
      <View style={colDir}>
        <Text style={[styles.heading, dirStyle]}>{t.promoteStore.heading}</Text>
        <Text style={[styles.sub, dirStyle]}>{t.promoteStore.description}</Text>
      </View>
      {renderBody()}
    </DashboardLayout>
  )
}

type MethodStepProps = {
  offer: StorePromotionOffer
  settings: SiteSettings | null
  wallet: WalletBalance | null
  submitError: string | null
  isPromoted: boolean
  onPickWallet: () => void
  onPickInstapay: () => void
  onPickMobileWallet: () => void
  onPickApple: () => void
}

type AndroidMethod = 'wallet' | 'instapay' | 'mobile-wallet'

function MethodStep(props: MethodStepProps) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const {
    offer,
    settings,
    wallet,
    submitError,
    isPromoted,
    onPickWallet,
    onPickInstapay,
    onPickMobileWallet,
    onPickApple,
  } = props

  const canWallet = wallet !== null && wallet.balance >= offer.price
  const instapayEnabled = settings?.instapayEnabled !== false
  const mobileWalletEnabled = settings?.mobileWalletEnabled !== false

  const [method, setMethod] = useState<AndroidMethod>(
    canWallet ? 'wallet' : instapayEnabled ? 'instapay' : 'mobile-wallet',
  )

  function proceed() {
    if (method === 'wallet') onPickWallet()
    else if (method === 'instapay') onPickInstapay()
    else onPickMobileWallet()
  }

  const ctaLabel = isPromoted ? t.promoteStore.promoteAgain : t.buySlots.buyArrow

  const errorBanner = submitError ? (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{submitError}</Text>
    </View>
  ) : null

  if (IS_IOS) {
    // Apple guideline 3.1.1: digital goods on iOS are sold only through IAP.
    if (!offer.appleProductId) {
      return (
        <View style={styles.methodBlock}>
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, dirStyle]}>{t.promoteStore.comingSoon}</Text>
          </View>
        </View>
      )
    }
    return (
      <View style={styles.methodBlock}>
        {errorBanner}
        <Pressable
          style={styles.primaryCta}
          onPress={onPickApple}
          accessibilityRole="button"
        >
          <Ionicons name="logo-apple" size={18} color={colors.dk} />
          <Text style={styles.primaryCtaText}>{t.buySlots.applePayCta}</Text>
        </Pressable>
        <LegalLinks />
      </View>
    )
  }

  return (
    <View style={styles.methodBlock}>
      <View style={colDir}>
        <Text style={[styles.sectionTitle, dirStyle]}>
          {t.buySlots.choosePaymentMethod}
        </Text>
      </View>

      <Pressable
        onPress={() => setMethod('wallet')}
        style={[
          styles.methodCard,
          method === 'wallet' && styles.methodCardSelected,
          !canWallet && styles.methodCardDisabled,
        ]}
        disabled={!canWallet}
        accessibilityRole="radio"
        accessibilityState={{ selected: method === 'wallet', disabled: !canWallet }}
      >
        <View style={[styles.methodHeader, rowDir]}>
          <View style={[styles.radioDot, method === 'wallet' && styles.radioDotOn]} />
          <Text style={[styles.methodTitle, dirStyle]}>
            {t.buySlots.payWithWallet}
          </Text>
        </View>
        <Text style={[styles.methodNote, dirStyle]}>
          {t.buySlots.payWithWalletNote} · {wallet ? `${wallet.balance} EGP` : '—'}
        </Text>
        {!canWallet ? (
          <Text style={[styles.methodWarn, dirStyle]}>
            {t.buySlots.insufficientWallet}
          </Text>
        ) : null}
      </Pressable>

      {instapayEnabled ? (
        <Pressable
          onPress={() => setMethod('instapay')}
          style={[
            styles.methodCard,
            method === 'instapay' && styles.methodCardSelected,
          ]}
          accessibilityRole="radio"
          accessibilityState={{ selected: method === 'instapay' }}
        >
          <View style={[styles.methodHeader, rowDir]}>
            <View style={[styles.radioDot, method === 'instapay' && styles.radioDotOn]} />
            <Text style={[styles.methodTitle, dirStyle]}>InstaPay</Text>
          </View>
          <Text style={[styles.methodNote, dirStyle]}>
            {t.buySlots.instantTransfer}
          </Text>
        </Pressable>
      ) : null}

      {mobileWalletEnabled ? (
        <Pressable
          onPress={() => setMethod('mobile-wallet')}
          style={[
            styles.methodCard,
            method === 'mobile-wallet' && styles.methodCardSelected,
          ]}
          accessibilityRole="radio"
          accessibilityState={{ selected: method === 'mobile-wallet' }}
        >
          <View style={[styles.methodHeader, rowDir]}>
            <View style={[styles.radioDot, method === 'mobile-wallet' && styles.radioDotOn]} />
            <Text style={[styles.methodTitle, dirStyle]}>
              {t.buySlots.mobileWallet}
            </Text>
          </View>
          <Text style={[styles.methodNote, dirStyle]}>
            {t.buySlots.walletsListed}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.primaryCta}
        onPress={proceed}
        accessibilityRole="button"
      >
        <Text style={styles.primaryCtaText}>{ctaLabel}</Text>
        <Ionicons
          name={ar ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.dk}
        />
      </Pressable>
    </View>
  )
}

type WalletStepProps = {
  offer: StorePromotionOffer
  wallet: WalletBalance | null
  submitting: boolean
  submitError: string | null
  onBack: () => void
  onPay: () => void
}

function WalletStep(props: WalletStepProps) {
  const { t } = useLocale()
  const { ar, colDir, dirStyle } = useDir()
  const { offer, wallet, submitting, submitError, onBack, onPay } = props
  return (
    <View style={styles.methodBlock}>
      <View style={[styles.summaryBox, colDir]}>
        <Text style={[styles.summaryLabel, dirStyle]}>{t.promoteStoreNav}</Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          {offer.price} EGP · {offer.days} {ar ? 'أيام' : 'days'}
        </Text>
        <Text style={[styles.summaryLabel, dirStyle]}>
          {t.buySlots.walletBalance}
        </Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          {wallet ? `${wallet.balance} EGP` : '—'}
        </Text>
      </View>

      {submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{submitError}</Text>
        </View>
      ) : null}

      <Button
        label={t.buySlots.payWithWallet}
        onPress={onPay}
        loading={submitting}
        disabled={submitting}
        fullWidth
      />
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={styles.backBtn}
        accessibilityRole="button"
        disabled={submitting}
      >
        <Text style={[styles.backBtnText, dirStyle]}>
          {ar ? 'رجوع' : 'Back'}
        </Text>
      </Pressable>
    </View>
  )
}

type ReceiptStepProps = {
  kind: 'instapay' | 'mobile-wallet'
  offer: StorePromotionOffer
  settings: SiteSettings | null
  screenshotKey: string
  setScreenshotKey: (k: string) => void
  buyerPhone: string
  setBuyerPhone: (p: string) => void
  submitting: boolean
  submitError: string | null
  onBack: () => void
  onSubmit: () => void
}

// Shared by the InstaPay and mobile-wallet flows: both show a transfer card,
// then collect a receipt screenshot and the sender's phone for admin review.
function ReceiptStep(props: ReceiptStepProps) {
  const { t } = useLocale()
  const { ar, colDir, dirStyle } = useDir()
  const {
    kind,
    offer,
    settings,
    screenshotKey,
    setScreenshotKey,
    buyerPhone,
    setBuyerPhone,
    submitting,
    submitError,
    onBack,
    onSubmit,
  } = props
  return (
    <View style={styles.methodBlock}>
      <View style={colDir}>
        <Text style={[styles.sectionTitle, dirStyle]}>
          {kind === 'instapay' ? 'InstaPay' : t.buySlots.mobileWallet}
        </Text>
      </View>

      {kind === 'instapay' ? (
        <InstapayQrCard amount={offer.price} />
      ) : (
        <MobileWalletCard
          amount={offer.price}
          walletNumber={settings?.mobileWalletAccount ?? ''}
          walletName={settings?.mobileWalletName ?? null}
        />
      )}

      <PaymentScreenshotUpload
        label={t.buySlots.transferReceiptPhoto}
        hint={t.buySlots.imageHint}
        value={screenshotKey}
        onChange={setScreenshotKey}
        context={kind === 'instapay' ? 'promote-store-instapay' : 'promote-store-mobile-wallet'}
      />

      <Input
        label={t.buySlots.yourPhone}
        placeholder={t.buySlots.phonePlaceholder}
        value={buyerPhone}
        onChangeText={setBuyerPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />

      {submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{submitError}</Text>
        </View>
      ) : null}

      <Button
        label={submitting ? t.buySlots.submitting : t.buySlots.sendReceipt}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
        fullWidth
      />
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={styles.backBtn}
        accessibilityRole="button"
        disabled={submitting}
      >
        <Text style={[styles.backBtnText, dirStyle]}>
          {ar ? 'رجوع' : 'Back'}
        </Text>
      </Pressable>
    </View>
  )
}

type AppleIapPanelProps = {
  summary: string
  submitting: boolean
  submitError: string | null
  onBack: () => void
}

function AppleIapPanel(props: AppleIapPanelProps) {
  const { t } = useLocale()
  const { ar, colDir, dirStyle } = useDir()
  const { summary, submitting, submitError, onBack } = props
  return (
    <View style={styles.methodBlock}>
      <View style={[styles.summaryBox, colDir]}>
        <Text style={[styles.summaryLabel, dirStyle]}>{t.promoteStoreNav}</Text>
        <Text style={[styles.summaryValue, dirStyle]}>{summary}</Text>
      </View>

      {submitting ? (
        <View style={styles.iapLoadingBox}>
          <ActivityIndicator color={colors.dk} />
          <Text style={[styles.iapLoadingText, dirStyle]}>
            {ar ? 'جارٍ معالجة الدفع عبر Apple…' : 'Processing Apple payment…'}
          </Text>
        </View>
      ) : null}

      {submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{submitError}</Text>
        </View>
      ) : null}

      <LegalLinks />

      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={styles.backBtn}
        accessibilityRole="button"
        disabled={submitting}
      >
        <Text style={[styles.backBtnText, dirStyle]}>
          {ar ? 'رجوع' : 'Back'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
  },
  iapLoadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iapLoadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g500,
    textAlign: 'center',
  },
  statusBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  statusTextOn: {
    color: colors.dk,
  },
  primaryCta: {
    marginTop: spacing.md,
    backgroundColor: colors.y,
    borderRadius: radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryCtaText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
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
    color: colors.g400,
  },
  methodBlock: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.dk,
    marginBottom: 4,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.sm,
  },
  methodCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    padding: spacing.md,
  },
  methodCardSelected: {
    borderColor: colors.y,
    backgroundColor: '#FFFBEA',
  },
  methodCardDisabled: {
    opacity: 0.55,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.g300,
    backgroundColor: colors.white,
  },
  radioDotOn: {
    borderColor: colors.y,
    backgroundColor: colors.y,
  },
  methodTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.dk,
  },
  methodNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    lineHeight: 18,
  },
  methodWarn: {
    marginTop: 4,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.red,
  },
  backBtn: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  summaryBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: 4,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.sm,
  },
  errorBannerText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.red,
    textAlign: 'center',
  },
  donePanel: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  doneIcon: {
    fontSize: 52,
    lineHeight: 60,
    marginBottom: spacing.xs,
  },
  doneTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.dk,
    textAlign: 'center',
  },
  doneBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  doneStatRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
  },
  doneStatValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  doneCtaRow: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
})
