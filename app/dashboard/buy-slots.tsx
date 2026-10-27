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
  ClientSlotBundle,
  SiteSettings,
  WalletBalance,
  getClientSlotBundles,
  getSiteSettings,
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
import {
  SLOT_SKUS,
  slotSkuForCount,
  iosFallbackDisplayPrice,
  getIapProduct,
} from '@/lib/iap-products'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'

const IMPORT_SCREENS = ['shopify', 'easyorders', 'excel'] as const

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

export default function BuySlotsScreen() {
  const { t, locale } = useLocale()
  const { user, refetchUser } = useAuth()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const params = useLocalSearchParams<{
    resumeProductId?: string
    resumeTo?: string
    screen?: string
    bundleId?: string
  }>()

  const [loading, setLoading] = useState(true)
  const [bundles, setBundles] = useState<ClientSlotBundle[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [step, setStep] = useState<Step>('pick')
  const [iosPriceMap, setIosPriceMap] = useState<Record<string, string>>({})
  const [screenshotKey, setScreenshotKey] = useState<string>('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // resumeTo=import comes from an import screen hitting the cap; `screen` is
  // whitelisted so a crafted deep link can't route anywhere else.
  const importScreen =
    params.resumeTo === 'import' && IMPORT_SCREENS.includes(params.screen as never)
      ? (params.screen as (typeof IMPORT_SCREENS)[number])
      : null
  const resumingImport = importScreen != null
  const resuming = Boolean(params.resumeProductId || params.resumeTo === 'add' || resumingImport)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, s, w] = await Promise.all([
          getClientSlotBundles().catch(() => []),
          getSiteSettings().catch(() => null),
          authFetch<WalletBalance>('/payments/wallet/balance').catch(() => null),
        ])
        if (cancelled) return
        setBundles(b)
        setSettings(s)
        setWallet(w)

        const presetId = params.bundleId ? Number(params.bundleId) : null
        if (presetId && b.some((x) => x.id === presetId)) {
          setSelectedId(presetId)
        } else if (b.length) {
          setSelectedId(b[0].id)
        }

        if (IS_IOS) {
          const products = await fetchIosProducts(SLOT_SKUS, 'in-app').catch(() => [])
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
  }, [params.bundleId])

  const selected = useMemo(
    () => bundles.find((b) => b.id === selectedId) ?? null,
    [bundles, selectedId],
  )

  function translatedBundle(bundle: ClientSlotBundle) {
    // Top-level bundle.name/description are seeded in English. Only a non-English
    // translation row is stored (currently just 'ar'). If no translation matches
    // the active locale, fall back to the English top-level fields — not
    // translations[0], which would be Arabic.
    const tr = bundle.translations?.find((x) => x.locale === locale)
    return {
      name: tr?.name ?? bundle.name,
      description: tr?.description ?? bundle.description ?? '',
    }
  }

  function displayPriceFor(bundle: ClientSlotBundle): string {
    if (IS_IOS) {
      const sku = slotSkuForCount(bundle.slotCount as 5 | 10)
      return iosPriceMap[sku] ?? iosFallbackDisplayPrice(sku) ?? `${Number(bundle.price)} EGP`
    }
    return `${Number(bundle.price)} EGP`
  }

  function perSlotLabel(bundle: ClientSlotBundle): string {
    const per = Number(bundle.price) / bundle.slotCount
    return `${per.toFixed(2)} ${ar ? 'ج.م' : 'EGP'} / ${t.buySlots.perSlotPermanent}`
  }

  function goToAddListing() {
    const target = params.resumeProductId
      ? `/products/add?productId=${params.resumeProductId}`
      : '/products/add'
    router.replace(target as never)
  }

  // Back to the import screen keeps its loaded preview; replace is the cold-start fallback.
  function goResume() {
    if (!importScreen) return goToAddListing()
    if (router.canGoBack()) router.back()
    else router.replace(`/products/import/${importScreen}` as never)
  }

  async function handleWalletPayment() {
    if (!selected) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const res = await authPost<{ status: string; newBalance: number }>(
        '/payments/client-slot-bundles/wallet',
        { bundleId: selected.id },
      )
      setWallet((prev) => (prev
        ? { ...prev, balance: res.newBalance }
        : { balance: res.newBalance, totalToppedUp: 0, totalSpent: 0 }))
      const profile = await finalizePaymentSuccess()
      if (profile) {
        await updateStoredUser(profile)
      }
      await refetchUser()
      setStep('wallet-done')
      if (resuming) {
        setTimeout(goResume, 1200)
      }
    } catch (err) {
      setSubmitError(authErrorMessage(err, t) || t.buySlots.paymentFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleInstapaySubmit() {
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
      await authPost('/payments/client-slot-bundles/instapay', {
        bundleId: selected.id,
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
      })
      setStep('instapay-done')
    } catch (err) {
      setSubmitError(authErrorMessage(err, t) || t.buySlots.paymentFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMobileWalletSubmit() {
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
      await authPost('/payments/client-slot-bundles/mobile-wallet', {
        bundleId: selected.id,
        screenshotKey,
        buyerPhone: buyerPhone.trim(),
      })
      setStep('mobile-wallet-done')
    } catch (err) {
      setSubmitError(authErrorMessage(err, t) || t.buySlots.paymentFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAppleIapPurchase() {
    if (!selected) return
    const sku = slotSkuForCount(selected.slotCount as 5 | 10)
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
          bundleId: selected.id,
          ...(customerPrice !== undefined && { customerPrice }),
          customerCurrency,
        },
      })
      await finishIosPurchase(purchase, product.isConsumable)
      const profile = await finalizePaymentSuccess()
      if (profile) {
        await updateStoredUser(profile)
      }
      await refetchUser()
      setStep('apple-iap-done')
      if (resuming) {
        setTimeout(goResume, 1200)
      }
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

  return (
    <DashboardLayout title={t.buySlots.navLabel}>
      <View style={colDir}>
        <Text style={[styles.heading, dirStyle]}>{t.buySlots.heading}</Text>
        <Text style={[styles.sub, dirStyle]}>{t.buySlots.description}</Text>
      </View>

      {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.heading} />
            <Text style={[styles.loadingText, dirStyle]}>{t.buySlots.loading}</Text>
          </View>
        ) : bundles.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, dirStyle]}>{t.buySlots.noBundles}</Text>
          </View>
        ) : step === 'pick' ? (
          <PickStep
            bundles={bundles}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            displayPriceFor={displayPriceFor}
            perSlotLabel={perSlotLabel}
            translatedBundle={translatedBundle}
            onContinue={() => setStep('method')}
            selected={selected}
          />
        ) : step === 'method' ? (
          <MethodStep
            selected={selected}
            settings={settings}
            wallet={wallet}
            onBack={() => setStep('pick')}
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
            onSubmit={handleInstapaySubmit}
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
            onSubmit={handleMobileWalletSubmit}
          />
        ) : step === 'wallet-done' ? (
          <View style={styles.donePanel}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, dirStyle]}>{t.buySlots.paymentSuccessTitle}</Text>
            <Text style={[styles.doneBody, dirStyle]}>{t.buySlots.walletDeductedBody}</Text>
            <View style={[styles.doneStatRow, rowDir]}>
              <Text style={[styles.doneStatLabel, dirStyle]}>{t.buySlots.remainingWalletBalance}</Text>
              <Text style={[styles.doneStatValue, dirStyle]}>
                {wallet !== null ? Number(wallet.balance).toFixed(2) : '…'} {ar ? 'ج.م' : 'EGP'}
              </Text>
            </View>
            {resuming ? (
              <Text style={[styles.doneRedirect, dirStyle]}>{resumingImport ? t.buySlots.redirectingToImport : t.buySlots.redirectingToListing}</Text>
            ) : null}
            <View style={styles.doneCtaRow}>
              {resuming ? (
                <>
                  <Button
                    label={resumingImport ? t.buySlots.continueImporting : t.buySlots.addListing}
                    variant="primary"
                    onPress={goResume}
                  />
                  <Button
                    label={t.buySlots.buyAnotherPack}
                    variant="outline"
                    onPress={() => {
                      setSelectedId(bundles[0]?.id ?? null)
                      setScreenshotKey('')
                      setBuyerPhone('')
                      setSubmitError(null)
                      setStep('pick')
                    }}
                  />
                </>
              ) : (
                <Button
                  label={t.buySlots.buyAnotherPack}
                  variant="primary"
                  onPress={() => {
                    setSelectedId(bundles[0]?.id ?? null)
                    setScreenshotKey('')
                    setBuyerPhone('')
                    setSubmitError(null)
                    setStep('pick')
                  }}
                />
              )}
            </View>
          </View>
        ) : step === 'apple-iap-done' ? (
          <View style={styles.donePanel}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, dirStyle]}>{t.buySlots.paymentSuccessTitle}</Text>
            <Text style={[styles.doneBody, dirStyle]}>{t.buySlots.appleSuccessBody}</Text>
            {resuming ? (
              <Text style={[styles.doneRedirect, dirStyle]}>{resumingImport ? t.buySlots.redirectingToImport : t.buySlots.redirectingToListing}</Text>
            ) : null}
            <View style={styles.doneCtaRow}>
              {resuming ? (
                <>
                  <Button
                    label={resumingImport ? t.buySlots.continueImporting : t.buySlots.addListing}
                    variant="primary"
                    onPress={goResume}
                  />
                  <Button
                    label={t.buySlots.buyAnotherPack}
                    variant="outline"
                    onPress={() => {
                      setSelectedId(bundles[0]?.id ?? null)
                      setSubmitError(null)
                      setStep('pick')
                    }}
                  />
                </>
              ) : (
                <Button
                  label={t.buySlots.buyAnotherPack}
                  variant="primary"
                  onPress={() => {
                    setSelectedId(bundles[0]?.id ?? null)
                    setSubmitError(null)
                    setStep('pick')
                  }}
                />
              )}
            </View>
          </View>
        ) : step === 'instapay-done' || step === 'mobile-wallet-done' ? (
          <View style={styles.donePanel}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, dirStyle]}>{t.buySlots.requestReceivedTitle}</Text>
            <Text style={[styles.doneBody, dirStyle]}>{t.buySlots.withinHours}</Text>
            {resuming ? (
              <Text style={[styles.doneRedirect, dirStyle]}>{resumingImport ? t.buySlots.finishImportAfterApproval : t.buySlots.finishAfterApproval}</Text>
            ) : null}
            <View style={styles.doneCtaRow}>
              {resuming ? (
                <>
                  <Button
                    label={resumingImport ? t.buySlots.continueImporting : t.buySlots.addListing}
                    variant="primary"
                    onPress={goResume}
                  />
                  <Button
                    label={t.buySlots.buyAnotherPack}
                    variant="outline"
                    onPress={() => {
                      setSelectedId(bundles[0]?.id ?? null)
                      setScreenshotKey('')
                      setBuyerPhone('')
                      setSubmitError(null)
                      setStep('pick')
                    }}
                  />
                </>
              ) : (
                <Button
                  label={t.buySlots.buyAnotherPack}
                  variant="primary"
                  onPress={() => {
                    setSelectedId(bundles[0]?.id ?? null)
                    setScreenshotKey('')
                    setBuyerPhone('')
                    setSubmitError(null)
                    setStep('pick')
                  }}
                />
              )}
            </View>
          </View>
      ) : null}
    </DashboardLayout>
  )
}

type PickStepProps = {
  bundles: ClientSlotBundle[]
  selectedId: number | null
  setSelectedId: (id: number) => void
  displayPriceFor: (b: ClientSlotBundle) => string
  perSlotLabel: (b: ClientSlotBundle) => string
  translatedBundle: (b: ClientSlotBundle) => { name: string; description: string }
  onContinue: () => void
  selected: ClientSlotBundle | null
}

function PickStep(props: PickStepProps) {
  const { t } = useLocale()
  const { ar, rowDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const { bundles, selectedId, setSelectedId, displayPriceFor, perSlotLabel, translatedBundle, onContinue, selected } = props
  return (
    <View style={styles.bundleList}>
            {bundles.map((b) => {
              const tr = translatedBundle(b)
              const isSel = b.id === selectedId
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setSelectedId(b.id)}
                  style={[styles.bundleCard, isSel && styles.bundleCardSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                >
                  <View style={[styles.bundleTop, rowDir]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bundleName, dirStyle]}>{tr.name}</Text>
                      {tr.description ? (
                        <Text style={[styles.bundleDesc, dirStyle]}>{tr.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.bundleSlotsPill}>
                      <Text style={styles.bundleSlotsPillText}>
                        +{b.slotCount}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.bundlePriceRow, rowDir]}>
                    <Text style={[styles.bundlePrice, dirStyle]}>
                      {displayPriceFor(b)}
                    </Text>
                    <Text style={[styles.bundlePerSlot, dirStyle]}>
                      {perSlotLabel(b)}
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
  selected: ClientSlotBundle | null
  settings: SiteSettings | null
  wallet: WalletBalance | null
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
        <View style={colDir}>
          <Text style={[styles.summaryLabel, dirStyle]}>
            {ar ? 'الباقة' : 'Bundle'}
          </Text>
          <Text style={[styles.summaryValue, dirStyle]}>
            {selected ? `+${selected.slotCount}` : ''}
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
  selected: ClientSlotBundle | null
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
  const slotCount = selected?.slotCount ?? 0
  return (
    <View style={styles.methodBlock}>
      <View style={[styles.summaryBox, colDir]}>
        <Text style={[styles.summaryLabel, dirStyle]}>
          {ar ? 'الباقة' : 'Bundle'}
        </Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          +{slotCount} · {price} EGP
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
  selected: ClientSlotBundle | null
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
        context="buy-slots-instapay"
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
  selected: ClientSlotBundle | null
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
        context="buy-slots-mobile-wallet"
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
  selected: ClientSlotBundle | null
  submitting: boolean
  submitError: string | null
  onBack: () => void
}

function AppleIapPanel(props: AppleIapPanelProps) {
  const { ar, colDir, dirStyle } = useDir()
  const { colors } = useTheme()
  const styles = useStyles()
  const { selected, submitting, submitError, onBack } = props
  const slotCount = selected?.slotCount ?? 0
  return (
    <View style={styles.methodBlock}>
      <View style={[styles.summaryBox, colDir]}>
        <Text style={[styles.summaryLabel, dirStyle]}>
          {ar ? 'الباقة' : 'Bundle'}
        </Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          +{slotCount}
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
  bundleList: {
    gap: spacing.sm,
  },
  bundleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bundleCardSelected: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
  },
  bundleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bundleName: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.heading,
    marginBottom: 2,
  },
  bundleDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  bundleSlotsPill: {
    backgroundColor: colors.fab,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bundleSlotsPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.y,
  },
  bundlePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  bundlePrice: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.price,
  },
  bundlePerSlot: {
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
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
