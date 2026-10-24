import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  LocationNode,
  SiteSettings,
  StoreProfile,
  StorePromotionOffer,
  UserProfile,
  WalletBalance,
  getLocations,
  getSiteSettings,
  getStorePromotionOffer,
  imgUrl,
  localeName,
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
import {
  P,
  ExtendTimeline,
  PayMethodCard,
  PlacementsCarousel,
  PriceTicket,
  ProfitEquation,
  PromoDock,
  PromoSection,
  PromotedStage,
  SpotlightStage,
  ViewsSparkline,
} from '@/components/PromoteSpotlight'

// Unicode first-strong isolate: keeps a price like "EGP 500.00" in one piece
// inside Arabic text instead of letting bidi reorder its number and currency.
function isolate(text: string): string {
  return `\u2068${text}\u2069`
}

function formatEgp(amount: number | string, ar: boolean): string {
  return `${amount} ${ar ? 'ج.م' : 'EGP'}`
}

function formatOfferSummary(template: string, price: string, days: number): string {
  return template.replace('{price}', isolate(price)).replace('{days}', String(days))
}

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

function LegalLinks({ dark }: { dark?: boolean }) {
  const { ar, rowDir } = useDir()
  const linkStyle = [styles.legalLink, dark && { color: P.g400 }]
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
        <Text style={linkStyle}>{termsLabel}</Text>
      </Pressable>
      <Text style={styles.legalDot}> · </Text>
      <Pressable
        onPress={() => router.push('/privacy')}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={privacyLabel}
      >
        <Text style={linkStyle}>{privacyLabel}</Text>
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

type AndroidMethod = 'wallet' | 'instapay' | 'mobile-wallet'

// Subset of GET /user/analytics used by the promotion pitch.
type PromoAnalytics = {
  totalViews: number
  totalPhoneClicks: number
  totalContacts?: number
  totalProducts?: number
  viewsByDay: Array<{ date: string; count: number }>
}

const DAY_MS = 86_400_000

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
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null)
  const [analytics, setAnalytics] = useState<PromoAnalytics | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<AndroidMethod | null>(null)

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    ;(async () => {
      try {
        // The offer is the primary data: let a failure surface as an error
        // state with retry instead of rendering a made-up price.
        // Analytics and locations only decorate the pitch; the screen works without them.
        const [o, s, w, profile, stats, locations] = await Promise.all([
          getStorePromotionOffer(),
          getSiteSettings().catch(() => null),
          authFetch<WalletBalance>('/payments/wallet/balance').catch(() => null),
          authFetch<UserProfile>('/user/profile').catch(() => null),
          authFetch<PromoAnalytics>('/user/analytics').catch(() => null),
          getLocations().catch(() => [] as LocationNode[]),
        ])
        if (cancelled) return
        setOffer(o)
        setSettings(s)
        setWallet(w)
        setPromotedUntil(profile ? (profile.storeProfile?.promotedUntil ?? null) : undefined)
        setStoreProfile(profile?.storeProfile ?? null)
        setAnalytics(stats)
        const locId = profile?.storeProfile?.locationId
        const loc = locId != null ? locations.find((l) => l.id === locId) : undefined
        setLocationName(loc ? localeName(loc.translations, locale) || null : null)

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
  }, [blocked, reloadKey, locale])

  const isPromoted = promotedUntil != null && Date.parse(promotedUntil) > Date.now()

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function offerSummary(o: StorePromotionOffer): string {
    const price = (IS_IOS && iosPrice) || formatEgp(o.price, ar)
    return formatOfferSummary(t.promoteStore.offerSummary, price, o.days)
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

  const canWallet = !!offer && wallet !== null && Number(wallet.balance) >= Number(offer.price)
  const instapayEnabled = settings?.instapayEnabled !== false
  const mobileWalletEnabled = settings?.mobileWalletEnabled !== false
  const defaultMethod: AndroidMethod = canWallet
    ? 'wallet'
    : instapayEnabled
      ? 'instapay'
      : 'mobile-wallet'
  const chosenMethod = payMethod ?? defaultMethod
  const showPitch = step === 'method' && !blocked && !loading && !loadFailed && !!offer

  function fmtNum(n: number): string {
    return n.toLocaleString('en-US')
  }

  // Buying again while active extends from the current end date.
  function newEndFor(o: StorePromotionOffer): string {
    const nowMs = Date.now()
    const untilMs = isPromoted && promotedUntil ? Date.parse(promotedUntil) : nowMs
    return new Date(Math.max(nowMs, untilMs) + o.days * DAY_MS).toISOString()
  }

  function pitchSections(o: StorePromotionOffer): React.ReactNode[] {
    const p = t.promoteStore
    const nowMs = Date.now()
    const untilMs = isPromoted && promotedUntil ? Date.parse(promotedUntil) : nowMs
    const daysLeft = Math.max(0, Math.ceil((untilMs - nowMs) / DAY_MS))
    const newEnd = newEndFor(o)

    const series = (analytics?.viewsByDay ?? []).slice(-30).map((d) => Number(d.count) || 0)
    const views = Math.max(analytics?.totalViews ?? 0, series.reduce((a, b) => a + b, 0))
    const contacts = analytics ? (analytics.totalContacts ?? analytics.totalPhoneClicks ?? 0) : 0
    const hasStats = !!analytics && views > 0

    const equation = hasStats ? (
      <PromoSection key="eq" ar={ar} title={p.equationTitle} side={p.last30}>
        <ProfitEquation
          ar={ar}
          views={fmtNum(views)}
          contacts={fmtNum(contacts)}
          viewsLabel={p.eqViews}
          contactsLabel={p.eqContact}
          salesLabel={p.eqSales}
          profitLabel={p.eqProfit}
          boost={
            contacts > 0
              ? p.eqBoost.replace('{n}', fmtNum(Math.max(1, Math.round(views / contacts))))
              : p.eqBoostGeneric
          }
        />
      </PromoSection>
    ) : null

    const sparkline =
      hasStats && series.length > 1 ? (
        <PromoSection key="views" ar={ar} title={p.viewsTitle}>
          <ViewsSparkline
            ar={ar}
            data={series}
            todayLabel={p.viewsToday.replace('{n}', fmtNum(series[series.length - 1]))}
            axisFrom={p.axisFrom}
            axisToday={p.axisToday}
          />
        </PromoSection>
      ) : null

    const price = Number(o.price)
    const ticket = (
      <PriceTicket
        key="ticket"
        ar={ar}
        label={p.ticketTitle}
        amount={IS_IOS && iosPrice ? iosPrice : fmtNum(price)}
        currency={IS_IOS && iosPrice ? undefined : ar ? 'ج.م' : 'EGP'}
        perDay={IS_IOS && iosPrice ? undefined : fmtNum(Math.round(price / Math.max(1, o.days)))}
        perDayUnit={p.perDayUnit}
        days={o.days}
        dayUnit={p.dayUnit}
        hint={p.ticketHint}
      />
    )

    const errorBanner = submitError ? (
      <View style={[styles.errorBanner, styles.darkInset]}>
        <Text style={styles.errorBannerText}>{submitError}</Text>
      </View>
    ) : null

    let payment: React.ReactNode
    if (IS_IOS) {
      // Apple guideline 3.1.1: digital goods on iOS are sold only through IAP.
      payment = o.appleProductId ? (
        <View key="pay" style={styles.darkInset}>
          {errorBanner}
          <LegalLinks dark />
        </View>
      ) : (
        <View key="pay" style={[styles.darkNotice, styles.darkInset]}>
          <Text style={[styles.darkNoticeText, dirStyle]}>{p.unavailable}</Text>
        </View>
      )
    } else {
      payment = (
        <View key="pay">
          <View style={[styles.darkInset, colDir]}>
            <Text style={[styles.darkSectionTitle, dirStyle]}>{t.buySlots.choosePaymentMethod}</Text>
          </View>
          <PayMethodCard
            ar={ar}
            icon="wallet-outline"
            title={t.buySlots.payWithWallet}
            note={`${t.buySlots.payWithWalletNote} · ${
              wallet ? isolate(formatEgp(wallet.balance, ar)) : '—'
            }`}
            warn={canWallet ? null : t.buySlots.insufficientWallet}
            selected={chosenMethod === 'wallet'}
            disabled={!canWallet}
            onPress={() => setPayMethod('wallet')}
          />
          {instapayEnabled ? (
            <PayMethodCard
              ar={ar}
              icon="flash-outline"
              title="InstaPay"
              note={`${t.buySlots.instantTransfer} · ${p.reviewNote}`}
              selected={chosenMethod === 'instapay'}
              onPress={() => setPayMethod('instapay')}
            />
          ) : null}
          {mobileWalletEnabled ? (
            <PayMethodCard
              ar={ar}
              icon="phone-portrait-outline"
              title={t.buySlots.mobileWallet}
              note={`${t.buySlots.walletsListed} · ${p.reviewNote}`}
              selected={chosenMethod === 'mobile-wallet'}
              onPress={() => setPayMethod('mobile-wallet')}
            />
          ) : null}
          {errorBanner}
        </View>
      )
    }

    if (isPromoted && promotedUntil) {
      return [
          <PromotedStage
            key="stage"
            ar={ar}
            daysLeft={daysLeft}
            days={o.days}
            liveLabel={p.liveNow}
            daysLeftLabel={p.daysLeft}
            title={p.promotedTitle}
            titleEm={p.promotedTitleEm}
            sub={p.runningUntil.replace('{date}', formatDate(promotedUntil))}
          />,
          <PromoSection
            key="extend"
            ar={ar}
            title={p.extendTitle}
            side={p.extendPlus.replace('{days}', String(o.days))}
          >
            <ExtendTimeline
              ar={ar}
              elapsed={Math.max(0, o.days - daysLeft)}
              left={daysLeft}
              added={o.days}
              legendElapsed={p.legendElapsed}
              legendLeft={p.legendLeft.replace('{n}', String(daysLeft))}
              legendAdded={p.legendAdded.replace('{days}', String(o.days))}
              note={p.extendNote
                .replace('{end}', formatDate(promotedUntil))
                .replace('{newEnd}', formatDate(newEnd))}
            />
          </PromoSection>,
          sparkline,
          equation,
          ticket,
          payment,
      ]
    }

    const name = storeProfile?.name || user?.displayName || ''
    const subLine = [
      locationName,
      analytics?.totalProducts != null
        ? p.productsCount.replace('{n}', fmtNum(analytics.totalProducts))
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return [
        <SpotlightStage
          key="stage"
          ar={ar}
          name={name}
          logoUrl={storeProfile?.logo ? imgUrl(storeProfile.logo, { w: 160 }) : null}
          subLine={subLine}
          firstBadge={p.firstBadge}
          featuredBadge={p.featuredBadge}
          title={p.stageTitle}
          titleEm={p.stageTitleEm}
          sub={p.stageSub}
        />,
        equation,
        sparkline,
        <PromoSection key="where" ar={ar} title={p.whereTitle} side={p.swipeHint}>
          <PlacementsCarousel
            ar={ar}
            items={[
              { title: p.place1Title, sub: p.place1Sub },
              { title: p.place2Title, sub: p.place2Sub },
              { title: p.place3Title, sub: p.place3Sub },
            ]}
          />
        </PromoSection>,
        ticket,
        payment,
    ]
  }

  function renderPitch(o: StorePromotionOffer) {
    return <View style={styles.pitch}>{pitchSections(o)}</View>
  }

  function renderDock(o: StorePromotionOffer) {
    const p = t.promoteStore
    const newEnd = newEndFor(o)
    const label = isPromoted
      ? p.ctaExtend.replace('{days}', String(o.days))
      : p.ctaPromote
    const trust = isPromoted ? p.newEndLine.replace('{date}', formatDate(newEnd)) : p.trustLine
    const price = (IS_IOS && iosPrice) || formatEgp(o.price, ar)
    if (IS_IOS) {
      return (
        <PromoDock
          ar={ar}
          label={label}
          price={price}
          trust={trust}
          loading={submitting}
          disabled={!o.appleProductId}
          onPress={handleAppleIapPurchase}
        />
      )
    }
    return (
      <PromoDock
        ar={ar}
        label={label}
        price={price}
        trust={trust}
        onPress={() => {
          setSubmitError(null)
          setStep(chosenMethod)
        }}
      />
    )
  }

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
        return renderPitch(offer)
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

  if (showPitch && offer) {
    return (
      <DashboardLayout
        title={t.promoteStoreNav}
        bodyColor={P.ink}
        contentPadding={false}
        bottomBar={renderDock(offer)}
      >
        {renderBody()}
      </DashboardLayout>
    )
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
          {formatOfferSummary(t.promoteStore.offerSummary, formatEgp(offer.price, ar), offer.days)}
        </Text>
        <Text style={[styles.summaryLabel, dirStyle]}>
          {t.buySlots.walletBalance}
        </Text>
        <Text style={[styles.summaryValue, dirStyle]}>
          {wallet ? formatEgp(wallet.balance, ar) : '—'}
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
  pitch: {
    paddingBottom: 24,
  },
  darkInset: {
    marginHorizontal: 14,
    marginTop: 14,
  },
  darkSectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  darkNotice: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: P.glass,
    borderWidth: 1,
    borderColor: P.line,
  },
  darkNoticeText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 20,
    color: P.g400,
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
