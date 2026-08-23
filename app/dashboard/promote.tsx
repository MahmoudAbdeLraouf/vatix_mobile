import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  authDelete,
  authErrorMessage,
  authFetch,
  authPost,
  refreshAccessToken,
  updateStoredUser,
} from '@/lib/auth'
import {
  Bundle,
  BundleTranslation,
  PromoInfo,
  PromotedProductItem,
  PromotionHistoryRow,
  SiteSettings,
  UserProfile,
  WalletBalance,
  getPromotionBundles,
  getSiteSettings,
  imgUrl,
} from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Step =
  | 'pick'
  | 'method'
  | 'instapay'
  | 'instapay-done'
  | 'mobile-wallet'
  | 'mobile-wallet-done'
  | 'wallet-done'
type PromoTab = 'ads' | 'history'

const DEFAULT_SETTINGS: SiteSettings = {
  instapayEnabled: true,
  instapayAccount: '',
  instapayName: 'Vatix',
  mobileWalletEnabled: false,
  mobileWalletAccount: '',
  mobileWalletName: 'Vatix',
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
  maxProductsPerClient: 5,
  maxActiveProductsPerStore: 20,
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

export default function PromoteScreen() {
  const { locale, t } = useLocale()
  const { user } = useAuth()
  const { ar, rowDir, colDir, dirStyle, trailAlign } = useDir()
  const params = useLocalSearchParams<{
    bundleId?: string
    resumeProductId?: string
  }>()
  const resumeProductId = params.resumeProductId
    ? String(params.resumeProductId)
    : null

  const [bundles, setBundles] = useState<Bundle[]>([])
  const [bundlesLoaded, setBundlesLoaded] = useState(false)
  const [credits, setCredits] = useState<PromoInfo | null>(null)
  const [wallet, setWallet] = useState<number | null>(null)
  const [promoted, setPromoted] = useState<PromotedProductItem[]>([])
  const [promotionHistory, setPromotionHistory] = useState<
    PromotionHistoryRow[]
  >([])
  const [paySettings, setPaySettings] = useState<SiteSettings>(DEFAULT_SETTINGS)

  const [selected, setSelected] = useState<number | null>(null)
  const [step, setStep] = useState<Step>('pick')
  const [tab, setTab] = useState<PromoTab>('ads')
  const [screenshot, setScreenshot] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  const load = useCallback(async () => {
    const [c, w, pp, ph] = await Promise.all([
      authFetch<PromoInfo>('/payments/promo-credits'),
      authFetch<WalletBalance>('/payments/wallet/balance'),
      authFetch<PromotedProductItem[]>('/payments/promoted-products'),
      authFetch<PromotionHistoryRow[]>('/payments/promotions/history'),
    ])
    setCredits(c ?? { total: 0 })
    setWallet(w?.balance ?? 0)
    setPromoted(pp ?? [])
    setPromotionHistory(ph ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [bs, s] = await Promise.all([
        getPromotionBundles().catch(() => [] as Bundle[]),
        getSiteSettings().catch(() => null),
      ])
      if (cancelled) return
      setBundles(bs)
      setBundlesLoaded(true)
      if (s) setPaySettings({ ...DEFAULT_SETTINGS, ...s })
      const pre = params.bundleId ? Number(params.bundleId) : null
      if (pre && bs.some(b => b.id === pre)) {
        setSelected(pre)
        setStep('method')
      }
      await load()
      if (!cancelled) setPageLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bundle = useMemo(
    () => bundles.find(b => b.id === selected) ?? null,
    [bundles, selected],
  )

  const bundleT: BundleTranslation | null = useMemo(() => {
    if (!bundle?.translations?.length) return null
    return (
      bundle.translations.find(x => x.locale === locale) ??
      bundle.translations.find(x => x.locale === 'en') ??
      bundle.translations[0] ??
      null
    )
  }, [bundle, locale])

  const canWallet =
    wallet !== null && bundle !== null && wallet >= Number(bundle.price ?? 0)

  const fmt = (n: number | string) =>
    Number(n ?? 0).toLocaleString(ar ? 'ar-EG' : 'en-EG')
  const currency = ar ? 'ج.م' : 'EGP'

  const METHOD_LABELS: Record<
    string,
    { emoji: string; label: string; color: string; bg: string }
  > = {
    wallet: {
      emoji: '👛',
      label: ar ? 'محفظة' : 'Wallet',
      color: colors.green,
      bg: colors.gl,
    },
    instapay: {
      emoji: '📱',
      label: 'InstaPay',
      color: '#7B2FBE',
      bg: '#F5EEFF',
    },
    mobile_wallet: {
      emoji: '📲',
      label: ar ? 'محفظة موبايل' : 'Mobile Wallet',
      color: '#10b981',
      bg: '#ECFDF5',
    },
    gift: {
      emoji: '🎁',
      label: ar ? 'مجاني' : 'Free',
      color: colors.yd,
      bg: colors.yl,
    },
    legacy: {
      emoji: '🎯',
      label: ar ? 'رصيد ترويج' : 'Credit',
      color: colors.g600,
      bg: colors.g100,
    },
  }

  const PROMO_STATUS_LABELS: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    success: {
      label: ar ? 'مكتمل' : 'Completed',
      color: colors.green,
      bg: colors.gl,
    },
    pending: {
      label: ar ? 'معلّق' : 'Pending',
      color: colors.yd,
      bg: colors.yl,
    },
    pending_verification: {
      label: ar ? 'قيد المراجعة' : 'Under Review',
      color: '#7B2FBE',
      bg: '#F5EEFF',
    },
    failed: { label: ar ? 'فشل' : 'Failed', color: colors.red, bg: colors.rl },
  }

  const chooseBundle = (id: number) => {
    setSelected(id)
    setError('')
    setScreenshot('')
    setPhone('')
    setStep('method')
  }

  const back = () => {
    if (step === 'instapay' || step === 'mobile-wallet') setStep('method')
    else setStep('pick')
    setError('')
    setScreenshot('')
    setPhone('')
  }

  const handleDelete = (productId: number) => {
    Alert.alert(
      ar ? 'حذف الإعلان' : 'Delete Listing',
      ar ? 'هل تريد حذف هذا الإعلان؟' : 'Delete this listing?',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await authDelete(`/products/${productId}`)
            load()
          },
        },
      ],
    )
  }

  const payInstapay = async () => {
    if (!bundle) return
    if (!screenshot) {
      setError(t.screenshotRequired)
      return
    }
    if (!phone || phone.trim().length < 6) {
      setError(t.phoneRequired)
      return
    }
    setLoading(true)
    setError('')
    try {
      await authPost('/payments/promotions/instapay', {
        bundleId: bundle.id,
        screenshotKey: screenshot,
        buyerPhone: phone.trim(),
      })
      setStep('instapay-done')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  const payMobileWallet = async () => {
    if (!bundle) return
    if (!screenshot) {
      setError(t.screenshotRequired)
      return
    }
    if (!phone || phone.trim().length < 6) {
      setError(t.phoneRequired)
      return
    }
    setLoading(true)
    setError('')
    try {
      await authPost('/payments/promotions/mobile-wallet', {
        bundleId: bundle.id,
        screenshotKey: screenshot,
        buyerPhone: phone.trim(),
      })
      setStep('mobile-wallet-done')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  const payWallet = async () => {
    if (!bundle) return
    setLoading(true)
    setError('')
    try {
      const res = await authPost<{ status?: string; newBalance?: number }>(
        '/payments/promotions/wallet',
        { bundleId: bundle.id },
      )
      if (res?.status && res.status !== 'success') {
        setError(t.paymentFailed)
        return
      }
      if (typeof res?.newBalance === 'number') setWallet(res.newBalance)
      await refreshAccessToken()
      const profile = await authFetch<UserProfile>('/user/profile')
      if (profile && user) {
        await updateStoredUser({
          ...user,
          type: profile.type,
          phone: profile.phone,
        })
      }
      await load()
      setStep('wallet-done')
      if (resumeProductId) {
        router.push('/dashboard/my-ads')
      }
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout title={ar ? 'ترويج الإعلانات' : 'Promote Listings'}>
      {pageLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.dk} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={styles.creditsCard}>
              <View style={[styles.creditsHead, rowDir]}>
                <Ionicons name="rocket" size={16} color={colors.y} />
                <View style={[{ flex: 1 }, colDir]}>
                  <Text style={[styles.creditsHeadText, dirStyle]}>
                    {ar ? 'رصيد الترويج' : 'Promo Credits'}
                  </Text>
                </View>
              </View>
              <View style={colDir}>
                <Text style={[styles.creditsBig, dirStyle]}>
                  {fmt(credits?.total ?? 0)}
                </Text>
                <Text style={[styles.creditsSub, dirStyle]}>
                  {ar ? 'إعلان متاح' : 'ads available'}
                </Text>
              </View>
            </View>

            <View style={styles.walletCard}>
              <View style={[styles.creditsHead, rowDir]}>
                <Ionicons name="wallet" size={16} color={colors.green} />
                <View style={[{ flex: 1 }, colDir]}>
                  <Text
                    style={[
                      styles.creditsHeadText,
                      dirStyle,
                      { color: colors.g700 },
                    ]}
                  >
                    {ar ? 'رصيد المحفظة' : 'Wallet Balance'}
                  </Text>
                </View>
              </View>
              <View style={colDir}>
                <Text style={[styles.walletBig, dirStyle]}>
                  {fmt(wallet ?? 0)}{' '}
                  <Text style={styles.walletCurrency}>{currency}</Text>
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/dashboard/wallet')}
                hitSlop={4}
                style={colDir}
              >
                <Text style={[styles.walletLink, dirStyle]}>
                  {ar ? 'إدارة المحفظة ←' : 'Manage Wallet →'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Step: pick */}
          {step === 'pick' && (
            <View style={styles.card}>
              <View style={colDir}>
                <Text style={[styles.cardTitle, dirStyle]}>
                  {ar ? '⭐ اشترِ باقة ترويج' : '⭐ Buy a Promo Pack'}
                </Text>
                <Text style={[styles.cardSub, dirStyle]}>
                  {ar
                    ? 'اختر باقة لترويج إعلاناتك وزيادة المشاهدات'
                    : 'Pick a bundle to promote your listings and boost views'}
                </Text>
              </View>

              {!bundlesLoaded ? (
                <View style={{ paddingVertical: spacing.lg }}>
                  <ActivityIndicator color={colors.dk} />
                </View>
              ) : bundles.length === 0 ? (
                <View style={colDir}>
                  <Text style={[styles.empty, dirStyle]}>
                    {ar ? 'لا توجد باقات متاحة' : 'No bundles available'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {bundles.map(b => {
                    const bt =
                      b.translations?.find(x => x.locale === locale) ??
                      b.translations?.find(x => x.locale === 'en') ??
                      null
                    const price = Number(b.price ?? 0)
                    const perAd = b.productCount
                      ? Math.round(price / b.productCount)
                      : price
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => chooseBundle(b.id)}
                        style={({ pressed }) => [
                          styles.bundle,
                          rowDir,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.bundleIcon}>
                          <Text style={{ fontSize: 22 }}>🚀</Text>
                        </View>
                        <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
                          <Text
                            style={[styles.bundleName, dirStyle]}
                            numberOfLines={1}
                          >
                            {bt?.name ?? b.name}
                          </Text>
                          <Text
                            style={[styles.bundleMeta, dirStyle]}
                            numberOfLines={1}
                          >
                            {ar
                              ? `${fmt(perAd)} ${currency} / إعلان · ٧ أيام`
                              : `${fmt(perAd)} ${currency} / ad · 7 days`}
                          </Text>
                        </View>
                        <View style={styles.bundlePrice}>
                          <Text style={styles.bundlePriceValue}>
                            {fmt(price)}
                          </Text>
                          <Text style={styles.bundlePriceCurrency}>
                            {currency}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* Step: method */}
          {step === 'method' && bundle && (
            <View style={styles.card}>
              <Pressable
                onPress={back}
                style={[styles.backRow, rowDir]}
                hitSlop={6}
                accessibilityRole="button"
              >
                <Ionicons
                  name={ar ? 'chevron-forward' : 'chevron-back'}
                  size={18}
                  color={colors.dk}
                />
                <Text style={[styles.backText, dirStyle]}>
                  {ar ? 'رجوع' : 'Back'}
                </Text>
              </Pressable>

              <View style={[styles.bundleSummary, rowDir]}>
                <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
                  <Text
                    style={[styles.bundleName, dirStyle]}
                    numberOfLines={1}
                  >
                    {bundleT?.name ?? bundle.name}
                  </Text>
                  <Text
                    style={[styles.bundleMeta, dirStyle]}
                    numberOfLines={1}
                  >
                    {ar
                      ? `${fmt(bundle.productCount)} إعلان · ٧ أيام`
                      : `${bundle.productCount} ads · 7 days`}
                  </Text>
                </View>
                <View style={styles.bundlePrice}>
                  <Text style={styles.bundlePriceValue}>
                    {fmt(bundle.price)}
                  </Text>
                  <Text style={styles.bundlePriceCurrency}>{currency}</Text>
                </View>
              </View>

              <View style={[{ marginTop: spacing.md }, colDir]}>
                <Text style={[styles.cardTitle, dirStyle]}>
                  {ar ? 'اختر طريقة الدفع' : 'Choose Payment Method'}
                </Text>
              </View>

              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                {paySettings.instapayEnabled && (
                  <MethodCard
                    icon="phone-portrait"
                    color={'#7B2FBE'}
                    bg={'#F5EDFA'}
                    title={ar ? 'انستاباي' : 'InstaPay'}
                    subtitle={
                      ar ? 'تحويل بنكي مع إيصال' : 'Bank transfer with receipt'
                    }
                    onPress={() => {
                      setStep('instapay')
                      setError('')
                    }}
                    disabled={loading}
                  />
                )}
                {paySettings.mobileWalletEnabled && (
                  <MethodCard
                    icon="phone-portrait-outline"
                    color={'#10b981'}
                    bg={'#ECFDF5'}
                    title={ar ? 'محفظة موبايل' : 'Mobile Wallet'}
                    subtitle={
                      ar
                        ? 'تحويل من محفظة الموبايل مع إيصال'
                        : 'Mobile wallet transfer with receipt'
                    }
                    onPress={() => {
                      setStep('mobile-wallet')
                      setError('')
                    }}
                    disabled={loading}
                  />
                )}
                <MethodCard
                  icon="wallet"
                  color={colors.green}
                  bg={colors.gl}
                  title={ar ? 'المحفظة' : 'Wallet'}
                  subtitle={
                    canWallet
                      ? ar
                        ? `الرصيد: ${fmt(wallet ?? 0)} ${currency}`
                        : `Balance: ${fmt(wallet ?? 0)} ${currency}`
                      : ar
                        ? 'رصيد غير كافٍ'
                        : 'Insufficient balance'
                  }
                  onPress={payWallet}
                  disabled={loading || !canWallet}
                />
              </View>

              {loading ? (
                <View style={styles.inlineLoader}>
                  <ActivityIndicator color={colors.dk} />
                </View>
              ) : null}
              {error ? <ErrorBox text={error} /> : null}
            </View>
          )}

          {/* Step: instapay form */}
          {step === 'instapay' && bundle && (
            <View style={styles.card}>
              <Pressable
                onPress={back}
                style={[styles.backRow, rowDir]}
                hitSlop={6}
                accessibilityRole="button"
              >
                <Ionicons
                  name={ar ? 'chevron-forward' : 'chevron-back'}
                  size={18}
                  color={colors.dk}
                />
                <Text style={[styles.backText, dirStyle]}>
                  {ar ? 'رجوع' : 'Back'}
                </Text>
              </Pressable>

              <InstapayQrCard amount={bundle.price} />

              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Input
                  label={ar ? 'رقم هاتفك (للتواصل)' : 'Your phone (for follow-up)'}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder={ar ? '01xxxxxxxxx' : '01xxxxxxxxx'}
                />
                <PaymentScreenshotUpload
                  label={ar ? 'لقطة الإيصال' : 'Receipt Screenshot'}
                  value={screenshot}
                  onChange={setScreenshot}
                  aspect="wide"
                  hint={
                    ar ? 'JPG أو PNG، حد أقصى ٥ ميجا' : 'JPG or PNG, max 5 MB'
                  }
                />
                <Button
                  label={ar ? 'إرسال الإيصال' : 'Send Receipt'}
                  variant="cta"
                  loading={loading}
                  onPress={payInstapay}
                  disabled={loading}
                />
                {error ? <ErrorBox text={error} /> : null}
              </View>
            </View>
          )}

          {/* Step: mobile-wallet form */}
          {step === 'mobile-wallet' && bundle && (
            <View style={styles.card}>
              <Pressable
                onPress={back}
                style={[styles.backRow, rowDir]}
                hitSlop={6}
                accessibilityRole="button"
              >
                <Ionicons
                  name={ar ? 'chevron-forward' : 'chevron-back'}
                  size={18}
                  color={colors.dk}
                />
                <Text style={[styles.backText, dirStyle]}>
                  {ar ? 'رجوع' : 'Back'}
                </Text>
              </Pressable>

              <MobileWalletCard
                amount={fmt(bundle.price)}
                walletNumber={paySettings.mobileWalletAccount ?? ''}
                walletName={paySettings.mobileWalletName ?? null}
              />

              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Input
                  label={ar ? 'رقم هاتفك (للتواصل)' : 'Your phone (for follow-up)'}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder={ar ? '01xxxxxxxxx' : '01xxxxxxxxx'}
                />
                <PaymentScreenshotUpload
                  label={ar ? 'لقطة الإيصال' : 'Receipt Screenshot'}
                  value={screenshot}
                  onChange={setScreenshot}
                  aspect="wide"
                  hint={
                    ar ? 'JPG أو PNG، حد أقصى ٥ ميجا' : 'JPG or PNG, max 5 MB'
                  }
                />
                <Button
                  label={ar ? 'إرسال الإيصال' : 'Send Receipt'}
                  variant="cta"
                  loading={loading}
                  onPress={payMobileWallet}
                  disabled={loading}
                />
                {error ? <ErrorBox text={error} /> : null}
              </View>
            </View>
          )}

          {/* Step: instapay-done */}
          {step === 'instapay-done' && (
            <View style={[styles.card, styles.doneCard]}>
              <View style={styles.doneIconWrap}>
                <Ionicons
                  name="checkmark-circle"
                  size={56}
                  color={colors.green}
                />
              </View>
              <Text style={styles.doneTitle}>
                {ar ? 'تم استلام الطلب!' : 'Request Received!'}
              </Text>
              <Text style={styles.doneBody}>
                {ar
                  ? 'سنراجع الإيصال خلال ٢٤ ساعة ونفعّل الباقة تلقائياً بعد التحقق.'
                  : 'We will review the receipt within 24 hours and activate the bundle automatically after verification.'}
              </Text>
              <Button
                label={ar ? 'العودة للباقات' : 'Back to Bundles'}
                variant="outline"
                onPress={() => {
                  setSelected(null)
                  setStep('pick')
                  setScreenshot('')
                  setPhone('')
                }}
                style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
              />
            </View>
          )}

          {/* Step: mobile-wallet-done */}
          {step === 'mobile-wallet-done' && (
            <View style={[styles.card, styles.doneCard]}>
              <View style={styles.doneIconWrap}>
                <Ionicons
                  name="checkmark-circle"
                  size={56}
                  color={colors.green}
                />
              </View>
              <Text style={styles.doneTitle}>
                {ar ? 'تم استلام الطلب!' : 'Request Received!'}
              </Text>
              <Text style={styles.doneBody}>
                {ar
                  ? 'سنراجع الإيصال خلال ٢٤ ساعة ونفعّل الباقة تلقائياً بعد التحقق.'
                  : 'We will review the receipt within 24 hours and activate the bundle automatically after verification.'}
              </Text>
              <Button
                label={ar ? 'العودة للباقات' : 'Back to Bundles'}
                variant="outline"
                onPress={() => {
                  setSelected(null)
                  setStep('pick')
                  setScreenshot('')
                  setPhone('')
                }}
                style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
              />
            </View>
          )}

          {/* Step: wallet-done */}
          {step === 'wallet-done' && (
            <View style={[styles.card, styles.doneCard]}>
              <View style={styles.doneIconWrap}>
                <Ionicons
                  name="checkmark-circle"
                  size={56}
                  color={colors.green}
                />
              </View>
              <Text style={styles.doneTitle}>
                {ar ? 'تم الدفع بنجاح!' : 'Payment Successful!'}
              </Text>
              <Text style={styles.doneBody}>
                {ar
                  ? `الرصيد المتبقي: ${fmt(wallet ?? 0)} ${currency}`
                  : `Remaining balance: ${fmt(wallet ?? 0)} ${currency}`}
              </Text>
              <Button
                label={ar ? 'ابدأ الترويج' : 'Start Promoting'}
                variant="cta"
                onPress={() => router.push('/dashboard/my-ads')}
                style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
              />
              <Button
                label={ar ? 'العودة للباقات' : 'Back to Bundles'}
                variant="ghost"
                onPress={() => {
                  setSelected(null)
                  setStep('pick')
                }}
                style={{ marginTop: spacing.xs, alignSelf: 'stretch' }}
              />
            </View>
          )}

          {/* Tabs + panels — only visible on pick step */}
          {step === 'pick' && (
            <View style={styles.card}>
              <View style={[styles.tabRow, rowDir]}>
                <TabButton
                  active={tab === 'ads'}
                  label={
                    ar
                      ? `إعلاناتي المروّجة (${promoted.length})`
                      : `My Promoted Ads (${promoted.length})`
                  }
                  onPress={() => setTab('ads')}
                />
                <TabButton
                  active={tab === 'history'}
                  label={
                    ar
                      ? `سجل المعاملات (${promotionHistory.length})`
                      : `Transactions (${promotionHistory.length})`
                  }
                  onPress={() => setTab('history')}
                />
              </View>

              {tab === 'ads' ? (
                promoted.length === 0 ? (
                  <View style={colDir}>
                    <Text style={[styles.empty, dirStyle]}>
                      {ar
                        ? 'لم تروّج أي إعلان بعد'
                        : "You haven't promoted any listings yet"}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {promoted.map(p => {
                      const endTs = new Date(p.promotedUntil).getTime()
                      const daysLeft = Math.max(
                        0,
                        Math.ceil((endTs - Date.now()) / 86400000),
                      )
                      const active = p.status === 'active'
                      const methodKey = p.method ?? 'legacy'
                      const m = METHOD_LABELS[methodKey] ?? METHOD_LABELS.legacy
                      const thumb = p.image ? imgUrl(p.image) : null
                      return (
                        <View key={p.productId} style={[styles.adRow, rowDir]}>
                          <View style={styles.adThumbWrap}>
                            {thumb ? (
                              <Image
                                source={{ uri: thumb }}
                                style={styles.adThumb}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.adThumb,
                                  styles.adThumbFallback,
                                ]}
                              >
                                <Ionicons
                                  name="image"
                                  size={20}
                                  color={colors.g500}
                                />
                              </View>
                            )}
                          </View>
                          <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
                            <Text
                              style={[styles.adTitle, dirStyle]}
                              numberOfLines={1}
                            >
                              {p.title}
                            </Text>
                            <Text
                              style={[styles.adMeta, dirStyle]}
                              numberOfLines={1}
                            >
                              {fmt(p.price)} {currency}
                            </Text>
                            <View style={[styles.adChipsRow, rowDir]}>
                              <View
                                style={[
                                  styles.chip,
                                  {
                                    backgroundColor: active
                                      ? colors.gl
                                      : colors.g100,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    {
                                      color: active
                                        ? colors.green
                                        : colors.g600,
                                    },
                                  ]}
                                >
                                  {active
                                    ? ar
                                      ? `نشط · ${daysLeft} يوم`
                                      : `Active · ${daysLeft}d`
                                    : ar
                                      ? 'منتهي'
                                      : 'Ended'}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.chip,
                                  { backgroundColor: m.bg },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    { color: m.color },
                                  ]}
                                >
                                  {m.emoji} {m.label}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={[styles.adActions, trailAlign, colDir]}>
                            <Pressable
                              onPress={() =>
                                router.push(`/products/${p.productId}`)
                              }
                              hitSlop={6}
                            >
                              <Text style={styles.adLink}>
                                {ar ? 'عرض ←' : 'View →'}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleDelete(p.productId)}
                              hitSlop={6}
                            >
                              <Text style={styles.adDelete}>
                                {ar ? 'حذف' : 'Delete'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )
              ) : promotionHistory.length === 0 ? (
                <View style={colDir}>
                  <Text style={[styles.empty, dirStyle]}>
                    {ar ? 'لا توجد معاملات بعد' : 'No transactions yet'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {promotionHistory.map(row => {
                    const methodKey = row.method ?? 'legacy'
                    const m =
                      METHOD_LABELS[methodKey] ?? METHOD_LABELS.legacy
                    const s = PROMO_STATUS_LABELS[row.status] ?? {
                      label: row.status,
                      color: colors.g600,
                      bg: colors.g100,
                    }
                    const isFree =
                      row.gift ||
                      row.method === 'gift' ||
                      Number(row.amount ?? 0) === 0
                    const dateFmt = new Date(row.createdAt).toLocaleDateString(
                      ar ? 'ar-EG' : 'en-EG',
                      { year: 'numeric', month: 'short', day: 'numeric' },
                    )
                    return (
                      <View key={row.id} style={[styles.orderRow, colDir]}>
                        <View style={[styles.orderHeader, rowDir]}>
                          <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
                            <Text style={[styles.creditsValue, dirStyle]}>
                              +{row.credits}{' '}
                              <Text style={styles.creditsUnit}>
                                {ar ? 'إعلان' : 'ads'}
                              </Text>
                            </Text>
                          </View>
                          <View style={[styles.orderTrail, trailAlign, colDir]}>
                            {isFree ? (
                              <Text
                                style={[
                                  styles.orderAmount,
                                  dirStyle,
                                  { color: colors.green },
                                ]}
                              >
                                {ar ? 'مجاناً' : 'Free'}
                              </Text>
                            ) : (
                              <Text style={[styles.orderAmount, dirStyle]}>
                                {fmt(Number(row.amount ?? 0))} {currency}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={[styles.adChipsRow, rowDir]}>
                          <View
                            style={[styles.chip, { backgroundColor: m.bg }]}
                          >
                            <Text
                              style={[styles.chipText, { color: m.color }]}
                            >
                              {m.emoji} {m.label}
                            </Text>
                          </View>
                          <View
                            style={[styles.chip, { backgroundColor: s.bg }]}
                          >
                            <Text
                              style={[styles.chipText, { color: s.color }]}
                            >
                              {s.label}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[styles.orderMeta, dirStyle]}
                          numberOfLines={1}
                        >
                          {dateFmt}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </DashboardLayout>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  )
}

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
  const { ar, rowDir, colDir, dirStyle } = useDir()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.method,
        rowDir,
        disabled && styles.methodDisabled,
        pressed && !disabled && styles.methodPressed,
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={[{ flex: 1, minWidth: 0 }, colDir]}>
        <Text style={[styles.methodTitle, dirStyle]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.methodSub, dirStyle]} numberOfLines={1}>
          {subtitle}
        </Text>
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
  const { rowDir, dirStyle } = useDir()
  return (
    <View style={[styles.instaRow, rowDir]}>
      <Text style={[styles.instaLabel, dirStyle]}>{label}</Text>
      <Text
        style={[
          styles.instaValue,
          dirStyle,
          highlight && { color: colors.y, fontFamily: fonts.extraBold },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function ErrorBox({ text }: { text: string }) {
  const { rowDir, colDir, dirStyle } = useDir()
  return (
    <View style={[styles.errorBox, rowDir]}>
      <Ionicons name="alert-circle" size={16} color={colors.red} />
      <View style={[{ flex: 1 }, colDir]}>
        <Text style={[styles.errorText, dirStyle]}>{text}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  inlineLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  creditsCard: {
    flex: 1,
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.md,
  },
  walletCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
  creditsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  creditsHeadText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.y,
    letterSpacing: 0.3,
  },
  creditsBig: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    color: colors.y,
    lineHeight: 36,
  },
  creditsSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.white,
    opacity: 0.75,
    marginTop: 2,
  },
  walletBig: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.green,
    lineHeight: 26,
  },
  walletCurrency: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g600,
  },
  walletLink: {
    marginTop: 6,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.dk,
  },

  // Card
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
  cardSub: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
    lineHeight: 18,
  },
  empty: {
    marginTop: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
    backgroundColor: colors.g100,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    ...shadow.ss,
  },
  tabBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
  },
  tabBtnTextActive: {
    color: colors.dk,
  },

  // Bundle picker
  bundle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.ss,
  },
  bundleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  bundleMeta: {
    marginTop: 4,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g500,
  },
  bundlePrice: {
    alignItems: 'center',
    minWidth: 60,
  },
  bundlePriceValue: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.dk,
    textAlign: 'center',
  },
  bundlePriceCurrency: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g600,
    textAlign: 'center',
  },

  // Method step
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  backText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
  },
  bundleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.g100,
    borderRadius: radius.md,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.ss,
  },
  methodDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  methodPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
    backgroundColor: colors.g100,
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

  // InstaPay
  instapayPanel: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#7B2FBE',
    gap: spacing.sm,
    ...shadow.sm,
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

  // Done panels
  doneCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  doneIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.gl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.dk,
    textAlign: 'center',
  },
  doneBody: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },

  // Promoted ads list
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    backgroundColor: colors.white,
  },
  adThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.g100,
  },
  adThumb: {
    width: '100%',
    height: '100%',
  },
  adThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
  },
  adMeta: {
    marginTop: 2,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
  },
  adChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  adActions: {
    gap: 6,
  },
  adLink: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.dk,
  },
  adDelete: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },

  // History rows
  orderRow: {
    gap: 8,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.g100,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  orderTrail: {
    gap: 4,
  },
  creditsValue: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.dk,
  },
  creditsUnit: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  orderMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
  },
  orderAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
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
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
})
