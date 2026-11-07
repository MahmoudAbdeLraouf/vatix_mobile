import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { darkColors, fonts, lightColors, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  ClientOfferPack,
  SiteSettings,
  WalletBalance,
  getClientOfferPacks,
  getSiteSettings,
} from '@/lib/api'
import { authFetch, authPost, authErrorMessage, AUTH_ERR } from '@/lib/auth'
import { getBroUsage, type BroUsage } from '@/lib/bro'
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
import {
  OFFER_SKUS,
  offerSkuForCount,
  iosFallbackDisplayPrice,
  getIapProduct,
} from '@/lib/iap-products'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'
import { useBroEnabled } from '@/components/bro/BroEntryCard'

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

function LegalLinks() {
  const { ar, rowDir } = useDir()
  const styles = useStyles()
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
  | 'pick'
  | 'method'
  | 'instapay'
  | 'instapay-done'
  | 'mobile-wallet'
  | 'mobile-wallet-done'
  | 'wallet'
  | 'wallet-done'
  | 'apple-iap'
  | 'apple-iap-done'


export default function BuyOffersScreen() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const broEnabled = useBroEnabled()
  const params = useLocalSearchParams<{ pack?: string }>()
  const b = t.bro

  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [packs, setPacks] = useState<ClientOfferPack[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  const [usage, setUsage] = useState<BroUsage | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [step, setStep] = useState<Step>('pick')
  const [iosPriceMap, setIosPriceMap] = useState<Record<string, string>>({})
  const [screenshotKey, setScreenshotKey] = useState<string>('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isClient = user?.type === 'client'

  useEffect(() => {
    // Nothing to load for a gated or ineligible user; the screen renders a notice instead.
    if (!broEnabled || !isClient) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [list, s, w, u] = await Promise.all([
          getClientOfferPacks().catch(() => null),
          getSiteSettings().catch(() => null),
          authFetch<WalletBalance>('/payments/wallet/balance').catch(() => null),
          getBroUsage(),
        ])
        if (cancelled) return
        setSettings(s)
        setWallet(w)
        setUsage(u)
        if (list === null) {
          setLoadFailed(true)
          return
        }
        setLoadFailed(false)
        // iOS can only sell packs that have an IAP SKU; hide the rest there.
        const visible = IS_IOS ? list.filter((x) => isOfferCount(x.offerCount)) : list
        setPacks(visible)

        // The cap sheet deep-links with ?pack=<id>; only honour ids that are actually offered.
        const presetId = params.pack ? Number(params.pack) : null
        if (presetId && visible.some((x) => x.id === presetId)) {
          setSelectedId(presetId)
          setStep('method')
        } else if (visible.length) {
          setSelectedId(visible[0].id)
        }

        if (IS_IOS) {
          const products = await fetchIosProducts(OFFER_SKUS, 'in-app').catch(() => [])
          if (cancelled) return
          const map: Record<string, string> = {}
          for (const prod of products as Array<{ id: string; displayPrice?: string }>) {
            if (prod?.id && prod.displayPrice) map[prod.id] = prod.displayPrice
          }
          setIosPriceMap(map)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.pack, broEnabled, isClient])

  const selected = useMemo(
    () => packs.find((p) => p.id === selectedId) ?? null,
    [packs, selectedId],
  )

  function translatedPack(pack: ClientOfferPack) {
    // Same fallback chain as the website: active locale, then English, then the top-level fields.
    const tr =
      pack.translations?.find((x) => x.locale === locale) ??
      pack.translations?.find((x) => x.locale === 'en')
    return {
      name: tr?.name ?? pack.name,
      description: tr?.description ?? pack.description ?? '',
    }
  }

  function displayPriceFor(pack: ClientOfferPack): string {
    if (IS_IOS && isOfferCount(pack.offerCount)) {
      const sku = offerSkuForCount(pack.offerCount)
      return iosPriceMap[sku] ?? iosFallbackDisplayPrice(sku) ?? `${Number(pack.price)} EGP`
    }
    return `${Number(pack.price)} EGP`
  }

  function perOfferLabel(pack: ClientOfferPack): string {
    const per = Math.round((Number(pack.price) / pack.offerCount) * 100) / 100
    return b.buyOffersPerOffer.replace('{n}', String(per))
  }

  // The balance is informational: a failed refresh keeps the previous figure.
  async function refreshUsage() {
    const u = await getBroUsage()
    if (u) setUsage(u)
  }

  function resetToPick() {
    setSelectedId(packs[0]?.id ?? null)
    setScreenshotKey('')
    setBuyerPhone('')
    setSubmitError(null)
    setStep('pick')
  }

  async function handleWalletPayment() {
    if (!selected) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const res = await authPost<{ status: string; newBalance: number }>(
        '/payments/client-offer-packs/wallet',
        { packId: selected.id },
      )
      setWallet((prev) => (prev
        ? { ...prev, balance: res.newBalance }
        : { balance: res.newBalance, totalToppedUp: 0, totalSpent: 0 }))
      await finalizePaymentSuccess()
      await refreshUsage()
      setStep('wallet-done')
    } catch (err) {
      setSubmitError(authErrorMessage(err, t) || t.buySlots.paymentFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleManualSubmit(route: 'instapay' | 'mobile-wallet') {
    if (!selected) return
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
      await authPost(`/payments/client-offer-packs/${route}`, {
        packId: selected.id,
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
      })
      setStep(route === 'instapay' ? 'instapay-done' : 'mobile-wallet-done')
    } catch (err) {
      setSubmitError(authErrorMessage(err, t) || t.buySlots.paymentFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAppleIapPurchase() {
    if (!selected) return
    if (!isOfferCount(selected.offerCount)) {
      setSubmitError(authErrorMessage(new Error(AUTH_ERR.IAP_PRODUCT_UNAVAILABLE), t))
      setStep('method')
      return
    }
    const sku = offerSkuForCount(selected.offerCount)
    const product = getIapProduct(sku)
    if (!product) {
      setSubmitError(authErrorMessage(new Error(AUTH_ERR.IAP_PRODUCT_UNAVAILABLE), t))
      setStep('method')
      return
    }
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
      await verifyIapPurchase({
        signedTransaction: jws,
        metadata: {
          packId: selected.id,
          offerCount: selected.offerCount,
          ...(customerPrice !== undefined && { customerPrice }),
          customerCurrency,
        },
      })
      await finishIosPurchase(purchase, product.isConsumable)
      await finalizePaymentSuccess()
      await refreshUsage()
      setStep('apple-iap-done')
    } catch (e: unknown) {
      if (cancelled) {
        setStep('method')
      } else {
        setSubmitError(authErrorMessage(e, t) || t.buySlots.paymentFailed)
        setStep('method')
      }
    } finally {
      subs.updated?.remove()
      subs.error?.remove()
      await endIap()
      setSubmitting(false)
    }
  }

  function renderDone(title: string, body: string, showWalletBalance: boolean) {
    return (
      <View style={styles.donePanel}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={[styles.doneTitle, dirStyle]}>{title}</Text>
        <Text style={[styles.doneBody, dirStyle]}>{body}</Text>
        {showWalletBalance ? (
          <View style={[styles.doneStatRow, rowDir]}>
            <Text style={[styles.doneStatLabel, dirStyle]}>{t.buySlots.remainingWalletBalance}</Text>
            <Text style={[styles.doneStatValue, dirStyle]}>
              {wallet !== null ? Number(wallet.balance).toFixed(2) : '…'} {ar ? 'ج.م' : 'EGP'}
            </Text>
          </View>
        ) : null}
        <View style={styles.doneCtaRow}>
          <Button
            label={b.buyOffersBackToBro}
            variant="primary"
            onPress={() => router.push('/bro' as never)}
          />
          <Button label={t.buySlots.buyAnotherPack} variant="outline" onPress={resetToPick} />
        </View>
      </View>
    )
  }

  if (!broEnabled) {
    return (
      <DashboardLayout title={b.buyOffersTitle}>
        <View style={styles.noticeCard}>
          <Text style={[styles.noticeTitle, dirStyle]}>{b.unavailableTitle}</Text>
          <Text style={[styles.noticeBody, dirStyle]}>{b.unavailableBody}</Text>
          <Button label={b.unavailableHome} variant="dk" size="md" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </DashboardLayout>
    )
  }

  if (!isClient) {
    return (
      <DashboardLayout title={b.buyOffersTitle}>
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, dirStyle]}>{b.buyOffersClientsOnly}</Text>
        </View>
      </DashboardLayout>
    )
  }

  const owned = usage?.offers.purchased ?? 0
  const cap = usage?.offers.cap ?? null
  const freeLeft = usage && cap !== null ? Math.max(0, cap - usage.offers.used) : null

  return (
    <DashboardLayout title={b.buyOffersTitle}>
      <View style={colDir}>
        <Text style={[styles.heading, dirStyle]}>{b.buyOffersTitle}</Text>
        <Text style={[styles.sub, dirStyle]}>{b.buyOffersIntro}</Text>
      </View>

      {usage ? (
        <View style={[styles.balanceCard, rowDir]}>
          <View style={styles.balanceInfo}>
            <Text style={[styles.balanceLabel, dirStyle]}>{b.buyOffersOwned}</Text>
            <Text style={[styles.balanceHint, dirStyle]}>{b.buyOffersNever}</Text>
            {freeLeft !== null ? (
              <Text style={[styles.balanceHint, dirStyle]}>
                {b.buyOffersFreeLeft}: {freeLeft}
              </Text>
            ) : null}
          </View>
          <Text style={styles.balanceValue}>{owned}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.heading} />
          <Text style={[styles.loadingText, dirStyle]}>{t.buySlots.loading}</Text>
        </View>
      ) : loadFailed ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, dirStyle]}>{b.buyOffersLoadFailed}</Text>
        </View>
      ) : packs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, dirStyle]}>{b.buyOffersNone}</Text>
        </View>
      ) : step === 'pick' ? (
        <PickStep
          packs={packs}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          displayPriceFor={displayPriceFor}
          perOfferLabel={perOfferLabel}
          translatedPack={translatedPack}
          onContinue={() => setStep('method')}
          selected={selected}
        />
      ) : step === 'method' ? (
        <MethodStep
          selected={selected}
          settings={settings}
          wallet={wallet}
          submitError={submitError}
          onBack={() => {
            setSubmitError(null)
            setStep('pick')
          }}
          onPickWallet={() => setStep('wallet')}
          onPickInstapay={() => setStep('instapay')}
          onPickMobileWallet={() => setStep('mobile-wallet')}
          onPickApple={handleAppleIapPurchase}
        />
      ) : step === 'apple-iap' ? (
        <AppleIapPanel
          selected={selected}
          submitting={submitting}
          submitError={submitError}
          onBack={() => {
            setSubmitError(null)
            setStep('method')
          }}
        />
      ) : step === 'wallet' ? (
        <WalletStep
          selected={selected}
          wallet={wallet}
          submitting={submitting}
          submitError={submitError}
          onBack={() => {
            setSubmitError(null)
            setStep('method')
          }}
          onPay={handleWalletPayment}
        />
      ) : step === 'instapay' ? (
        <InstapayStep
          selected={selected}
          settings={settings}
          screenshotKey={screenshotKey}
          setScreenshotKey={setScreenshotKey}
          buyerPhone={buyerPhone}
          setBuyerPhone={setBuyerPhone}
          submitting={submitting}
          submitError={submitError}
          onBack={() => {
            setSubmitError(null)
            setStep('method')
          }}
          onSubmit={() => handleManualSubmit('instapay')}
        />
      ) : step === 'mobile-wallet' ? (
        <MobileWalletStep
          selected={selected}
          settings={settings}
          screenshotKey={screenshotKey}
          setScreenshotKey={setScreenshotKey}
          buyerPhone={buyerPhone}
          setBuyerPhone={setBuyerPhone}
          submitting={submitting}
          submitError={submitError}
          onBack={() => {
            setSubmitError(null)
            setStep('method')
          }}
          onSubmit={() => handleManualSubmit('mobile-wallet')}
        />
      ) : step === 'wallet-done' ? (
        renderDone(t.buySlots.paymentSuccessTitle, b.buyOffersWalletBody, true)
      ) : step === 'apple-iap-done' ? (
        renderDone(t.buySlots.paymentSuccessTitle, t.buySlots.appleSuccessBody, false)
      ) : step === 'instapay-done' || step === 'mobile-wallet-done' ? (
        renderDone(t.buySlots.requestReceivedTitle, b.buyOffersPendingBody, false)
      ) : null}
    </DashboardLayout>
  )
}

// Only these offer counts have an App Store SKU.
function isOfferCount(n: number): n is 50 | 100 {
  return n === 50 || n === 100
}

type PickStepProps = {
  packs: ClientOfferPack[]
  selectedId: number | null
  setSelectedId: (id: number) => void
  displayPriceFor: (b: ClientOfferPack) => string
  perOfferLabel: (b: ClientOfferPack) => string
  translatedPack: (b: ClientOfferPack) => { name: string; description: string }
  onContinue: () => void
  selected: ClientOfferPack | null
}

function PickStep(props: PickStepProps) {
  const { t } = useLocale()
  const { ar, rowDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const { packs, selectedId, setSelectedId, displayPriceFor, perOfferLabel, translatedPack, onContinue, selected } = props
  return (
    <View style={styles.packList}>
            {packs.map((b) => {
              const tr = translatedPack(b)
              const isSel = b.id === selectedId
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setSelectedId(b.id)}
                  style={[styles.packCard, isSel && styles.packCardSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                >
                  <View style={[styles.packTop, rowDir]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.packName, dirStyle]}>{tr.name}</Text>
                      {tr.description ? (
                        <Text style={[styles.packDesc, dirStyle]}>{tr.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.packCountPill}>
                      <Text style={styles.packCountPillText}>
                        +{b.offerCount}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.packPriceRow, rowDir]}>
                    <Text style={[styles.packPrice, dirStyle]}>
                      {displayPriceFor(b)}
                    </Text>
                    <Text style={[styles.packPerOffer, dirStyle]}>
                      {perOfferLabel(b)}
                    </Text>
                  </View>
                </Pressable>
              )
            })}

      <Pressable
        style={[styles.primaryCta, !selected && styles.primaryCtaDisabled]}
        disabled={!selected}
        onPress={onContinue}
        accessibilityRole="button"
      >
        <Text style={styles.primaryCtaText}>{t.buySlots.buyArrow}</Text>
        <Ionicons
          name={ar ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.dk}
        />
      </Pressable>
    </View>
  )
}

type MethodStepProps = {
  selected: ClientOfferPack | null
  settings: SiteSettings | null
  wallet: WalletBalance | null
  submitError: string | null
  onBack: () => void
  onPickWallet: () => void
  onPickInstapay: () => void
  onPickMobileWallet: () => void
  onPickApple: () => void
}

type AndroidMethod = 'wallet' | 'instapay' | 'mobile-wallet'

function MethodStep(props: MethodStepProps) {
  const { t } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const {
    selected,
    settings,
    wallet,
    submitError,
    onBack,
    onPickWallet,
    onPickInstapay,
    onPickMobileWallet,
    onPickApple,
  } = props

  const price = selected ? Number(selected.price) : 0
  const canWallet = wallet !== null && selected !== null && wallet.balance >= price

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

  if (IS_IOS) {
    return (
      <View style={styles.methodBlock}>
        {submitError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}
        <View style={colDir}>
          <Text style={[styles.summaryLabel, dirStyle]}>
            {ar ? 'الباقة' : 'Pack'}
          </Text>
          <Text style={[styles.summaryValue, dirStyle]}>
            {selected ? `+${selected.offerCount}` : ''}
          </Text>
        </View>
        <Pressable
          style={styles.primaryCta}
          onPress={onPickApple}
          accessibilityRole="button"
        >
          <Ionicons name="logo-apple" size={18} color={colors.dk} />
          <Text style={styles.primaryCtaText}>{t.buySlots.applePayCta}</Text>
        </Pressable>
        <LegalLinks />
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Text style={[styles.backBtnText, dirStyle]}>
            {ar ? 'رجوع' : 'Back'}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.methodBlock}>
    {submitError ? (
      <View style={styles.errorBanner}>
        <Text style={styles.errorBannerText}>{submitError}</Text>
      </View>
    ) : null}
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
        <Text style={styles.primaryCtaText}>{t.buySlots.buyArrow}</Text>
        <Ionicons
          name={ar ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.dk}
        />
      </Pressable>

      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={styles.backBtn}
        accessibilityRole="button"
      >
        <Text style={[styles.backBtnText, dirStyle]}>
          {ar ? 'رجوع' : 'Back'}
        </Text>
      </Pressable>
    </View>
  )
}

type WalletStepProps = {
  selected: ClientOfferPack | null
  wallet: WalletBalance | null
  submitting: boolean
  submitError: string | null
  onBack: () => void
  onPay: () => void
}

function WalletStep(props: WalletStepProps) {
  const { t } = useLocale()
  const { ar, colDir, dirStyle } = useDir()
  const styles = useStyles()
  const { selected, wallet, submitting, submitError, onBack, onPay } = props
  const price = selected ? Number(selected.price) : 0
  const offerCount = selected?.offerCount ?? 0
  return (
    <View style={styles.methodBlock}>
      <View style={[styles.summaryBox, colDir]}>
        <Text style={[styles.summaryLabel, dirStyle]}>
          {ar ? 'الباقة' : 'Pack'}
        </Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          +{offerCount} · {price} EGP
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

type InstapayStepProps = {
  selected: ClientOfferPack | null
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

function InstapayStep(props: InstapayStepProps) {
  const { t } = useLocale()
  const { ar, colDir, dirStyle } = useDir()
  const styles = useStyles()
  const {
    selected,
    screenshotKey,
    setScreenshotKey,
    buyerPhone,
    setBuyerPhone,
    submitting,
    submitError,
    onBack,
    onSubmit,
  } = props
  const amount = selected ? Number(selected.price) : 0
  return (
    <View style={styles.methodBlock}>
      <View style={colDir}>
        <Text style={[styles.sectionTitle, dirStyle]}>InstaPay</Text>
      </View>

      <InstapayQrCard amount={amount} />

      <PaymentScreenshotUpload
        label={t.buySlots.transferReceiptPhoto}
        hint={t.buySlots.imageHint}
        value={screenshotKey}
        onChange={setScreenshotKey}
        context="buy-offers-instapay"
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

type MobileWalletStepProps = {
  selected: ClientOfferPack | null
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

function MobileWalletStep(props: MobileWalletStepProps) {
  const { t } = useLocale()
  const { ar, colDir, dirStyle } = useDir()
  const styles = useStyles()
  const {
    selected,
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
  const amount = selected ? Number(selected.price) : 0
  const walletNumber = settings?.mobileWalletAccount ?? ''
  const walletName = settings?.mobileWalletName ?? null
  return (
    <View style={styles.methodBlock}>
      <View style={colDir}>
        <Text style={[styles.sectionTitle, dirStyle]}>
          {t.buySlots.mobileWallet}
        </Text>
      </View>

      <MobileWalletCard
        amount={amount}
        walletNumber={walletNumber}
        walletName={walletName}
      />

      <PaymentScreenshotUpload
        label={t.buySlots.transferReceiptPhoto}
        hint={t.buySlots.imageHint}
        value={screenshotKey}
        onChange={setScreenshotKey}
        context="buy-offers-mobile-wallet"
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
  selected: ClientOfferPack | null
  submitting: boolean
  submitError: string | null
  onBack: () => void
}

function AppleIapPanel(props: AppleIapPanelProps) {
  const { ar, colDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const { selected, submitting, submitError, onBack } = props
  const offerCount = selected?.offerCount ?? 0
  return (
    <View style={styles.methodBlock}>
      <View style={[styles.summaryBox, colDir]}>
        <Text style={[styles.summaryLabel, dirStyle]}>
          {ar ? 'الباقة' : 'Pack'}
        </Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          +{offerCount}
        </Text>
      </View>

      {submitting ? (
        <View style={styles.iapLoadingBox}>
          <ActivityIndicator color={colors.heading} />
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

const makeStyles = (colors: ThemeColors, dark?: boolean) => StyleSheet.create({
  heading: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.heading,
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
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
    color: colors.muted,
  },
  iapLoadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iapLoadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  emptyBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  packList: {
    gap: spacing.sm,
  },
  packCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  packCardSelected: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
  },
  packTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  packName: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.heading,
    marginBottom: 2,
  },
  packDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  packCountPill: {
    backgroundColor: colors.fab,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  packCountPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.y,
  },
  packPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  packPrice: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.price,
  },
  packPerOffer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
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
  primaryCtaDisabled: {
    opacity: 0.45,
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
    color: colors.heading,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.subtle,
  },
  methodBlock: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.heading,
    marginBottom: 4,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.heading,
    marginBottom: spacing.sm,
  },
  methodCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  methodCardSelected: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
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
    borderColor: colors.dot,
    backgroundColor: colors.card,
  },
  radioDotOn: {
    borderColor: colors.y,
    backgroundColor: colors.y,
  },
  methodTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.heading,
  },
  methodNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
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
    color: colors.muted,
  },
  summaryBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  errorBanner: {
    backgroundColor: colors.redBg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: dark ? 'rgba(239,68,68,0.35)' : '#FECACA',
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
    color: colors.heading,
    textAlign: 'center',
  },
  doneBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  doneStatRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  doneStatValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.heading,
  },
  doneRedirect: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  doneCtaRow: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  noticeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  noticeTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.heading,
  },
  noticeBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  balanceInfo: {
    flex: 1,
    gap: 2,
  },
  balanceLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
  },
  balanceHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  balanceValue: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.heading,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}

