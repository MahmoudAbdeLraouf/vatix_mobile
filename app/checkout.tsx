import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { WebBrowserResult } from 'expo-web-browser'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { authFetch } from '@/lib/auth'
import {
  PlanData,
  SiteSettings,
  WalletBalance,
  getSiteSettings,
  getSubscriptionPlans,
} from '@/lib/api'
import {
  PaymentContext,
  PaymentGateway,
  SubscriptionType,
  finalizePaymentSuccess,
  initiateInstapayPromotion,
  initiateInstapaySubscription,
  initiateInstapayWalletTopup,
  initiateKashierPromotion,
  initiateKashierSubscription,
  initiateKashierWalletTopup,
  initiatePaymobPromotion,
  initiatePaymobSubscription,
  initiatePaymobWalletTopup,
  openGatewayInBrowser,
  payWithWalletForPromotion,
  payWithWalletForSubscription,
} from '@/lib/payment'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Panel = 'pick' | 'instapay' | 'processing'

const DEFAULT_SETTINGS: SiteSettings = {
  kashierEnabled: true,
  instapayEnabled: true,
  instapayAccount: '',
  instapayName: 'Vatix',
  otpVerificationEnabled: true,
  email: null,
  phone: null,
  whatsapp: null,
  twitter: null,
  instagram: null,
  facebook: null,
  tiktok: null,
  youtube: null,
  linkedin: null,
  iosMinVersion: null,
  iosLatestVersion: null,
  iosStoreUrl: null,
  androidMinVersion: null,
  androidLatestVersion: null,
  androidStoreUrl: null,
}

const PLAN_META: Record<SubscriptionType, { fallbackPrice: number; storeType: string }> = {
  subscription_store: { fallbackPrice: 300, storeType: 'store' },
  subscription_store_plus: { fallbackPrice: 500, storeType: 'store_plus' },
}

export default function CheckoutScreen() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const ar = locale === 'ar'
  const currency = t.egp

  const params = useLocalSearchParams<{
    context?: PaymentContext
    type?: SubscriptionType
    bundleId?: string
    amount?: string
    title?: string
    gateway?: PaymentGateway
  }>()

  const context = (params.context ?? 'subscription') as PaymentContext
  const subType = params.type as SubscriptionType | undefined
  const bundleId = params.bundleId ? Number(params.bundleId) : null
  const amountParam = params.amount ? Number(params.amount) : null
  const preferredGateway: PaymentGateway = params.gateway === 'paymob' ? 'paymob' : 'kashier'

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [wallet, setWallet] = useState<number | null>(null)
  const [plans, setPlans] = useState<PlanData[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>('pick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [screenshot, setScreenshot] = useState('')

  const load = useCallback(async () => {
    setPageLoading(true)
    try {
      const [s, w, p] = await Promise.all([
        getSiteSettings().catch(() => DEFAULT_SETTINGS),
        authFetch<WalletBalance>('/payments/wallet/balance'),
        context === 'subscription' ? getSubscriptionPlans().catch(() => []) : Promise.resolve([]),
      ])
      setSettings(s ?? DEFAULT_SETTINGS)
      setWallet(w ? Number(w.balance ?? 0) : 0)
      setPlans(p ?? [])
    } finally {
      setPageLoading(false)
    }
  }, [context])

  useEffect(() => {
    void load()
  }, [load])

  // ─── Amount / title resolution ────────────────────────────────────────────

  const amount = useMemo(() => {
    if (context === 'subscription' && subType) {
      const meta = PLAN_META[subType]
      const priceStr = plans.find(p => p.storeType === meta.storeType)?.price
      const num = priceStr != null ? Number(priceStr) : NaN
      return Number.isFinite(num) && num > 0 ? num : meta.fallbackPrice
    }
    if (context === 'promotion' && amountParam != null && amountParam > 0) return amountParam
    if (context === 'wallet_topup' && amountParam != null && amountParam > 0) return amountParam
    return amountParam ?? 0
  }, [context, subType, plans, amountParam])

  const title = useMemo(() => {
    if (params.title) return params.title
    if (context === 'subscription') {
      if (subType === 'subscription_store_plus') return t.storeTypeStorePlus
      if (subType === 'subscription_store') return t.storeTypeStore
      return t.subscription
    }
    if (context === 'wallet_topup') return t.topUp
    return ar ? 'ترويج إعلان' : 'Promote listing'
  }, [ar, context, params.title, subType, t])

  const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString(ar ? 'ar-EG' : 'en') : '0')

  const canWallet = wallet !== null && amount > 0 && wallet >= amount

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openWithGateway = async (url: string): Promise<WebBrowserResult | null> => {
    try {
      return await openGatewayInBrowser(url)
    } catch {
      return null
    }
  }

  const routeToCallback = (gateway: PaymentGateway, paymentId: number) => {
    if (gateway === 'kashier') {
      router.replace({ pathname: '/payment/kashier/callback', params: { paymentId: String(paymentId) } })
    } else {
      router.replace({ pathname: '/payment/callback', params: { paymentId: String(paymentId) } })
    }
  }

  const payCard = async () => {
    if (amount <= 0) {
      setError(ar ? 'المبلغ غير صحيح' : 'Invalid amount')
      return
    }
    setBusy(true)
    setError('')
    try {
      let url = ''
      let paymentId = 0
      const gw = preferredGateway
      if (gw === 'kashier') {
        if (context === 'subscription' && subType) {
          const res = await initiateKashierSubscription({ type: subType })
          url = res.sessionUrl
          paymentId = res.paymentId
        } else if (context === 'promotion' && bundleId) {
          const res = await initiateKashierPromotion({ bundleId })
          url = res.sessionUrl
          paymentId = res.paymentId
        } else if (context === 'wallet_topup') {
          const res = await initiateKashierWalletTopup({ amount })
          url = res.sessionUrl
          paymentId = res.paymentId
        }
      } else {
        if (context === 'subscription' && subType) {
          const res = await initiatePaymobSubscription({ type: subType })
          url = res.iframeUrl
          paymentId = res.paymentId
        } else if (context === 'promotion' && bundleId) {
          const res = await initiatePaymobPromotion({ bundleId })
          url = res.iframeUrl
          paymentId = res.paymentId
        } else if (context === 'wallet_topup') {
          const res = await initiatePaymobWalletTopup({ amount })
          url = res.iframeUrl
          paymentId = res.paymentId
        }
      }

      if (!url || !paymentId) {
        setError(ar ? 'تعذّر بدء عملية الدفع' : 'Could not start payment')
        return
      }

      setPanel('processing')
      await openWithGateway(url)
      // Any result (opened/cancel/dismiss) — hand off to the callback screen,
      // which polls status and decides success vs. failed.
      routeToCallback(gw, paymentId)
    } catch (e: any) {
      setError(e?.message || (ar ? 'فشل الدفع' : 'Payment failed'))
      setPanel('pick')
    } finally {
      setBusy(false)
    }
  }

  const payWallet = async () => {
    if (!canWallet) {
      setError(t.insufficientBalance)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (context === 'subscription' && subType) {
        await payWithWalletForSubscription({ type: subType })
      } else if (context === 'promotion' && bundleId) {
        await payWithWalletForPromotion({ bundleId })
      } else {
        setError(ar ? 'المحفظة غير متاحة لهذه العملية' : 'Wallet not available for this operation')
        return
      }
      await finalizePaymentSuccess()
      router.replace({ pathname: '/payment/success', params: { source: 'wallet', context } })
    } catch (e: any) {
      setError(e?.message || (ar ? 'فشل الدفع' : 'Payment failed'))
    } finally {
      setBusy(false)
    }
  }

  const submitInstapay = async () => {
    if (!screenshot) {
      setError(t.screenshotRequired)
      return
    }
    if (!phone || phone.trim().length < 6) {
      setError(ar ? 'الرجاء إدخال رقم هاتفك' : 'Please enter your phone number')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = { screenshotUrl: screenshot, buyerPhone: phone.trim() }
      if (context === 'subscription' && subType) {
        await initiateInstapaySubscription({ ...payload, type: subType })
      } else if (context === 'promotion' && bundleId) {
        await initiateInstapayPromotion({ ...payload, bundleId })
      } else if (context === 'wallet_topup') {
        await initiateInstapayWalletTopup({ ...payload, amount })
      } else {
        setError(ar ? 'العملية غير مدعومة' : 'Unsupported operation')
        return
      }
      router.replace({ pathname: '/payment/success', params: { source: 'instapay', context } })
    } catch (e: any) {
      setError(e?.message || (ar ? 'فشل الإرسال' : 'Submission failed'))
    } finally {
      setBusy(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top === 0 ? spacing.sm : 0 }]}>
        <Pressable
          onPress={() => (panel === 'instapay' ? setPanel('pick') : router.back())}
          hitSlop={8}
          style={styles.headerBtn}
        >
          <Ionicons
            name={ar ? 'chevron-forward' : 'chevron-back'}
            size={22}
            color={colors.dk}
          />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ar ? 'الدفع' : 'Checkout'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {pageLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.dk} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Order summary */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign: ar ? 'right' : 'left' }]}>
              {ar ? 'ملخّص الطلب' : 'Order Summary'}
            </Text>
            <View style={styles.summary}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.summaryName, { textAlign: ar ? 'right' : 'left' }]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
                <Text
                  style={[styles.summaryMeta, { textAlign: ar ? 'right' : 'left' }]}
                >
                  {contextSubtitle(context, ar)}
                </Text>
              </View>
              <View style={styles.summaryPrice}>
                <Text style={styles.summaryPriceValue}>{fmt(amount)}</Text>
                <Text style={styles.summaryPriceCurrency}>{currency}</Text>
              </View>
            </View>
          </View>

          {/* Method picker */}
          {panel === 'pick' && (
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { textAlign: ar ? 'right' : 'left' }]}>
                {t.choosePaymentMethod}
              </Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                {settings.kashierEnabled && (
                  <MethodCard
                    icon="card"
                    color={colors.dk}
                    bg={colors.g100}
                    title={t.payWithCard}
                    subtitle={
                      preferredGateway === 'kashier'
                        ? ar
                          ? 'دفع فوري عبر Kashier'
                          : 'Instant via Kashier'
                        : ar
                          ? 'دفع فوري عبر PayMob'
                          : 'Instant via PayMob'
                    }
                    onPress={payCard}
                    disabled={busy}
                  />
                )}
                {settings.instapayEnabled && (
                  <MethodCard
                    icon="phone-portrait"
                    color={'#7B2FBE'}
                    bg={'#F5EDFA'}
                    title={t.payWithInstapay}
                    subtitle={ar ? 'تحويل بنكي مع إيصال' : 'Bank transfer with receipt'}
                    onPress={() => {
                      setPanel('instapay')
                      setError('')
                    }}
                    disabled={busy}
                  />
                )}
                {context !== 'wallet_topup' && (
                  <MethodCard
                    icon="wallet"
                    color={colors.green}
                    bg={colors.gl}
                    title={t.payWithWallet}
                    subtitle={
                      canWallet
                        ? `${t.walletBalance}: ${fmt(wallet ?? 0)} ${currency}`
                        : t.insufficientBalance
                    }
                    onPress={payWallet}
                    disabled={busy || !canWallet}
                  />
                )}
              </View>

              {busy ? (
                <View style={styles.inlineLoader}>
                  <ActivityIndicator color={colors.dk} />
                </View>
              ) : null}
              {error ? <ErrorBox text={error} /> : null}
            </View>
          )}

          {/* InstaPay panel */}
          {panel === 'instapay' && (
            <View style={styles.card}>
              <View style={styles.instapayPanel}>
                <View style={styles.instapayHead}>
                  <Ionicons name="phone-portrait" size={18} color={colors.white} />
                  <Text style={styles.instapayHeadText}>
                    {ar ? 'الدفع عبر انستاباي' : 'Pay via InstaPay'}
                  </Text>
                </View>
                <InstaRow
                  label={t.instapayAccountLabel}
                  value={settings.instapayAccount || '—'}
                />
                <InstaRow
                  label={t.instapayNameLabel}
                  value={settings.instapayName || 'Vatix'}
                />
                <InstaRow
                  label={t.amountLabel}
                  value={`${fmt(amount)} ${currency}`}
                  highlight
                />
              </View>

              <View style={styles.instructionsBox}>
                <Text style={[styles.instructionsTitle, { textAlign: ar ? 'right' : 'left' }]}>
                  {ar ? '📋 خطوات الدفع' : '📋 Payment Steps'}
                </Text>
                <Text style={[styles.instructionsBody, { textAlign: ar ? 'right' : 'left' }]}>
                  {ar
                    ? '١. حوّل المبلغ عبر انستاباي\n٢. التقط لقطة شاشة للإيصال\n٣. ارفعها هنا وأرسل الطلب\n٤. سيتم التحقق خلال ٢٤ ساعة'
                    : '1. Transfer the amount via InstaPay\n2. Take a screenshot of the receipt\n3. Upload it here and submit\n4. We verify within 24 hours'}
                </Text>
              </View>

              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Input
                  label={t.buyerPhone}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="01xxxxxxxxx"
                />
                <FileUpload
                  label={t.uploadScreenshot}
                  value={screenshot}
                  onChange={setScreenshot}
                  aspect="wide"
                  hint={ar ? 'JPG أو PNG، حد أقصى ٥ ميجا' : 'JPG or PNG, max 5 MB'}
                />
                <Button
                  label={t.submitPayment}
                  variant="cta"
                  loading={busy}
                  onPress={submitInstapay}
                  disabled={busy}
                />
                {error ? <ErrorBox text={error} /> : null}
              </View>
            </View>
          )}

          {/* Processing panel — awaiting return from gateway browser */}
          {panel === 'processing' && (
            <View style={[styles.card, { alignItems: 'center', gap: spacing.md }]}>
              <ActivityIndicator color={colors.dk} size="large" />
              <Text style={styles.processingText}>
                {ar
                  ? 'يتم فتح بوابة الدفع… أكمل العملية ثم عد إلى التطبيق.'
                  : 'Opening the payment gateway… complete the payment and return to the app.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function contextSubtitle(context: PaymentContext, ar: boolean): string {
  if (context === 'subscription') return ar ? 'اشتراك شهري' : 'Monthly subscription'
  if (context === 'wallet_topup') return ar ? 'شحن المحفظة' : 'Wallet top-up'
  return ar ? 'باقة ترويج' : 'Promotion bundle'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MethodCard({
  icon,
  color,
  bg,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  color: string
  bg: string
  title: string
  subtitle: string
  onPress: () => void
  disabled?: boolean
}) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.method,
        disabled && { opacity: 0.5 },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.methodTitle, { textAlign: ar ? 'right' : 'left' }]}>{title}</Text>
        <Text style={[styles.methodSub, { textAlign: ar ? 'right' : 'left' }]}>{subtitle}</Text>
      </View>
      <Ionicons
        name={ar ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={colors.g500}
      />
    </Pressable>
  )
}

function InstaRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <View style={styles.instaRow}>
      <Text style={styles.instaLabel}>{label}</Text>
      <Text
        style={[
          styles.instaValue,
          highlight && { color: colors.y, fontFamily: fonts.extraBold },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={colors.red} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.g200,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.dk,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inlineLoader: { paddingVertical: spacing.md, alignItems: 'center' },
  pressed: { opacity: 0.85 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.sm,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.dk,
  },

  // Summary
  summary: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.g100,
    borderRadius: radius.md,
  },
  summaryName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  summaryMeta: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
  },
  summaryPrice: { alignItems: 'center' },
  summaryPriceValue: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.dk,
  },
  summaryPriceCurrency: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g600,
  },

  // Method
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  methodSub: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
  },

  // InstaPay panel
  instapayPanel: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#7B2FBE',
    gap: spacing.sm,
  },
  instapayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  instapayHeadText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  instaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  instaLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  instaValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  instructionsBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.yl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.y,
  },
  instructionsTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: 6,
  },
  instructionsBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.dk,
    lineHeight: 20,
  },

  processingText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g700,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.rl,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.red,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
})
