import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import type { EventSubscription, Purchase, PurchaseError } from 'react-native-iap'
import {
  expiredConvertToClient,
  expiredPayIap,
  expiredPayInstapay,
  expiredPayMobileWallet,
  getSiteSettings,
  getSubscriptionPlans,
  type PlanData,
  uploadPublic,
} from '@/lib/api'
import { AUTH_ERR, authErrorMessage } from '@/lib/auth'
import {
  addPurchaseErrorListener,
  addPurchaseUpdatedListener,
  endIap,
  finishIosPurchase,
  getIosJws,
  initIap,
  requestIosPurchase,
  requireIosProduct,
} from '@/lib/iap'
import {
  getIapProduct,
  iosFallbackDisplayPrice,
  SKU_SUBSCRIPTION_STORE,
} from '@/lib/iap-products'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { IS_IOS, PAID_UI_ENABLED } from '@/lib/platform'

// Last-resort fallback used only if the plans fetch fails or no matching plan
// is active. Normally the dialog resolves the price from `/subscriptions/plans`
// so admin updates to SubscriptionPlan.price are reflected in the QR / wallet
// cards without a mobile release.
const FALLBACK_AMOUNT = 450

type Step =
  | 'choice'
  | 'convert-confirm'
  | 'instapay'
  | 'instapay-done'
  | 'mobile-wallet'
  | 'mobile-wallet-done'
  | 'apple-iap'
  | 'apple-iap-done'

interface PaySettings {
  instapayEnabled: boolean
  mobileWalletEnabled: boolean
  mobileWalletAccount: string | null
  mobileWalletName: string | null
}

const DEFAULT_PAY_SETTINGS: PaySettings = {
  instapayEnabled: true,
  mobileWalletEnabled: false,
  mobileWalletAccount: null,
  mobileWalletName: null,
}

interface Props {
  visible: boolean
  phone: string
  password: string
  onClose: () => void
}

function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const }) : null,
    colDir: ar ? ({ direction: 'rtl' as const }) : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
  }
}

export function ExpiredStoreDialog({ visible, phone, password, onClose }: Props) {
  const { t } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const auth = useAuth()
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const styles = useStyles()

  const [step, setStep] = useState<Step>('choice')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotLocal, setScreenshotLocal] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [buyerPhone, setBuyerPhone] = useState('')
  const [paySettings, setPaySettings] = useState<PaySettings>(DEFAULT_PAY_SETTINGS)
  const [iosPriceMap, setIosPriceMap] = useState<
    Record<string, { price: number; currency: string } | undefined>
  >({})
  const [plans, setPlans] = useState<PlanData[] | null>(null)

  const planPrice = (() => {
    if (!plans) return null
    const match = plans.find(
      (p) => p.isActive && p.storeType === 'store' && (p.billingCycle ?? 'monthly') === 'monthly',
    )
    if (!match) return null
    const n = typeof match.price === 'string' ? Number(match.price) : match.price
    return Number.isFinite(n) ? n : null
  })()
  const amount = planPrice ?? FALLBACK_AMOUNT

  useEffect(() => {
    if (!visible) return
    setStep('choice')
    setError('')
    setBusy(false)
    setScreenshotUrl(null)
    setScreenshotLocal(null)
    setBuyerPhone('')
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    getSiteSettings()
      .then((s) => {
        if (cancelled) return
        setPaySettings({
          instapayEnabled: s.instapayEnabled,
          mobileWalletEnabled: s.mobileWalletEnabled,
          mobileWalletAccount: s.mobileWalletAccount,
          mobileWalletName: s.mobileWalletName,
        })
      })
      .catch(() => {
        /* keep defaults on failure — instapay remains enabled */
      })
    getSubscriptionPlans()
      .then((list) => {
        if (cancelled) return
        setPlans(list)
      })
      .catch(() => {
        /* fall back to FALLBACK_AMOUNT at render time */
      })
    return () => {
      cancelled = true
    }
  }, [visible])

  useEffect(() => {
    if (!IS_IOS || !visible) return
    let cancelled = false
    const sku = SKU_SUBSCRIPTION_STORE
    const product = getIapProduct(sku)
    if (!product) return
    ;(async () => {
      try {
        await initIap()
        const sk = await requireIosProduct(sku, product.type)
        if (cancelled) return
        const price = typeof sk.price === 'number' ? sk.price : undefined
        const currency = sk.currency || 'EGP'
        if (price !== undefined) {
          setIosPriceMap((m) => ({ ...m, [sku]: { price, currency } }))
        }
      } catch {
        /* fall back to iosFallbackDisplayPrice(sku) at render time */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible])

  function handleClose() {
    if (busy || uploading) return
    onClose()
  }

  async function handleConvert() {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await expiredConvertToClient(phone, password)
      await auth.login(res, undefined)
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
      setBusy(false)
    }
  }

  async function handlePickScreenshot() {
    if (uploading) return
    setError('')
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setError(t.allowPhotoAccess)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    setScreenshotLocal(asset.uri)
    setUploading(true)
    try {
      const url = await uploadPublic(asset.uri, asset.mimeType ?? 'image/jpeg')
      setScreenshotUrl(url)
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
      setScreenshotLocal(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmitInstapay() {
    if (busy) return
    if (!screenshotUrl) {
      setError(t.expiredRecovery.missingScreenshot)
      return
    }
    if (!buyerPhone.trim()) {
      setError(t.expiredRecovery.missingBuyerPhone)
      return
    }
    setError('')
    setBusy(true)
    try {
      await expiredPayInstapay(phone, password, screenshotUrl, buyerPhone.trim(), 'monthly')
      setStep('instapay-done')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitMobileWallet() {
    if (busy) return
    if (!screenshotUrl) {
      setError(t.expiredRecovery.missingScreenshot)
      return
    }
    if (!buyerPhone.trim()) {
      setError(t.expiredRecovery.missingBuyerPhone)
      return
    }
    setError('')
    setBusy(true)
    try {
      await expiredPayMobileWallet(phone, password, screenshotUrl, buyerPhone.trim(), 'monthly')
      setStep('mobile-wallet-done')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  async function handleAppleIapPurchase() {
    if (busy) return
    setError('')
    setBusy(true)
    const sku = SKU_SUBSCRIPTION_STORE
    const product = getIapProduct(sku)
    if (!product) {
      setError(authErrorMessage(new Error(AUTH_ERR.IAP_PRODUCT_UNAVAILABLE), t))
      setBusy(false)
      return
    }
    const subs: { updated: EventSubscription | null; error: EventSubscription | null } = {
      updated: null,
      error: null,
    }
    let cancelled = false
    try {
      await initIap()
      const sk = await requireIosProduct(sku, product.type)
      const customerPrice = typeof sk.price === 'number' ? sk.price : undefined
      const customerCurrency = sk.currency || 'EGP'
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
      setStep('apple-iap')
      const jws = await getIosJws(purchase)
      if (!jws) throw new Error('Could not verify transaction')
      const res = await expiredPayIap(phone, password, jws, {
        billingCycle: 'monthly',
        ...(customerPrice !== undefined && { customerPrice }),
        customerCurrency,
      })
      await finishIosPurchase(purchase, product.isConsumable)
      setStep('apple-iap-done')
      await auth.login(res, undefined)
    } catch (e: unknown) {
      if (cancelled) {
        setStep('choice')
      } else {
        setError(authErrorMessage(e, t))
        setStep('choice')
      }
    } finally {
      subs.updated?.remove()
      subs.error?.remove()
      await endIap()
      setBusy(false)
    }
  }

  function confirmConvert() {
    Alert.alert(
      t.expiredRecovery.convertConfirmTitle,
      t.expiredRecovery.convertConfirmBody,
      [
        { text: t.expiredRecovery.back, style: 'cancel' },
        { text: t.expiredRecovery.convertBtn, style: 'destructive', onPress: handleConvert },
      ],
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, rowDir]}>
            <Text style={[styles.sheetTitle, dirStyle]} numberOfLines={1}>
              {step === 'instapay'
                ? t.expiredRecovery.instapayTitle
                : step === 'convert-confirm'
                  ? t.expiredRecovery.convertConfirmTitle
                  : step === 'instapay-done'
                    ? t.expiredRecovery.instapayDoneTitle
                    : step === 'mobile-wallet'
                      ? t.expiredRecovery.mobileWalletTitle
                      : step === 'mobile-wallet-done'
                        ? t.expiredRecovery.mobileWalletDoneTitle
                        : step === 'apple-iap'
                          ? t.expiredRecovery.appleProcessing
                          : step === 'apple-iap-done'
                            ? t.expiredRecovery.appleDoneTitle
                            : t.expiredRecovery.title}
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior="padding"
            enabled={Platform.OS === 'ios'}
            keyboardVerticalOffset={20}
          >
            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              {!!error && (
                <View style={[styles.errorBox, rowDir]}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
                  <Text style={[styles.errorText, dirStyle]}>{error}</Text>
                </View>
              )}

              {step === 'choice' && (
                <>
                  <Text style={[styles.subtitle, dirStyle]}>
                    {t.expiredRecovery.subtitle}
                  </Text>

                  {/* iOS hides paid entry (App Store §3.1.1) */}
                  {PAID_UI_ENABLED && paySettings.instapayEnabled && (
                    <MethodCard
                      icon="phone-portrait-outline"
                      iconColor="#7B2FBE"
                      title={t.expiredRecovery.optionInstapayTitle}
                      subtitle={t.expiredRecovery.optionInstapayDesc}
                      onPress={() => setStep('instapay')}
                      variant="purple"
                      rowDir={rowDir}
                      dirStyle={dirStyle}
                    />
                  )}

                  {PAID_UI_ENABLED && paySettings.mobileWalletEnabled && (
                    <MethodCard
                      icon="wallet-outline"
                      iconColor="#10b981"
                      title={t.expiredRecovery.optionMobileWalletTitle}
                      subtitle={t.expiredRecovery.optionMobileWalletDesc}
                      onPress={() => setStep('mobile-wallet')}
                      variant="green"
                      rowDir={rowDir}
                      dirStyle={dirStyle}
                    />
                  )}

                  {IS_IOS && (() => {
                    const sku = SKU_SUBSCRIPTION_STORE
                    const priced = iosPriceMap[sku]
                    const priceLabel = priced
                      ? `${priced.price.toFixed(2)} ${priced.currency}`
                      : iosFallbackDisplayPrice(sku)
                    return (
                      <MethodCard
                        icon="logo-apple"
                        iconColor={colors.heading}
                        title={t.expiredRecovery.optionAppleTitle}
                        subtitle={`${t.expiredRecovery.optionAppleDesc} · ${priceLabel}`}
                        onPress={handleAppleIapPurchase}
                        rowDir={rowDir}
                        dirStyle={dirStyle}
                      />
                    )
                  })()}
                </>
              )}

              {step === 'convert-confirm' && (
                <>
                  <View style={[styles.warningBox, rowDir]}>
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={colors.red}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={[styles.warningText, dirStyle]}>
                      {t.expiredRecovery.convertConfirmBody}
                    </Text>
                  </View>

                  <View style={[styles.actionsRow, rowDir]}>
                    <View style={styles.actionCell}>
                      <Button
                        label={t.expiredRecovery.back}
                        variant="outline"
                        size="lg"
                        onPress={() => setStep('choice')}
                        disabled={busy}
                      />
                    </View>
                    <View style={styles.actionCell}>
                      <Button
                        label={busy ? t.expiredRecovery.converting : t.expiredRecovery.convertBtn}
                        variant="red"
                        size="lg"
                        onPress={confirmConvert}
                        loading={busy}
                        disabled={busy}
                      />
                    </View>
                  </View>
                </>
              )}

              {PAID_UI_ENABLED && step === 'instapay' && (
                <>

                  <InstapayQrCard amount={amount} />

                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={[styles.fieldLabel, dirStyle]}>
                      {t.expiredRecovery.screenshot}
                    </Text>
                    <Pressable
                      onPress={handlePickScreenshot}
                      disabled={uploading}
                      style={({ pressed }) => [
                        styles.uploadBox,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {screenshotLocal ? (
                        <Image
                          source={{ uri: screenshotLocal }}
                          style={styles.uploadPreview}
                        />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Ionicons name="cloud-upload-outline" size={28} color={colors.muted} />
                          <Text style={styles.uploadHint}>{t.expiredRecovery.screenshot}</Text>
                        </View>
                      )}
                      {uploading && (
                        <View style={styles.uploadOverlay}>
                          <ActivityIndicator color={colors.white} />
                        </View>
                      )}
                    </Pressable>
                  </View>

                  <Input
                    label={t.expiredRecovery.buyerPhone}
                    value={buyerPhone}
                    onChangeText={setBuyerPhone}
                    keyboardType="phone-pad"
                    placeholder={t.expiredRecovery.buyerPhonePlaceholder}
                    style={{ textAlign: 'left', writingDirection: 'ltr' }}
                  />

                  <View style={[styles.actionsRow, rowDir]}>
                    <View style={styles.actionCell}>
                      <Button
                        label={t.expiredRecovery.back}
                        variant="outline"
                        size="lg"
                        onPress={() => setStep('choice')}
                        disabled={busy || uploading}
                      />
                    </View>
                    <View style={styles.actionCell}>
                      <Button
                        label={busy ? t.expiredRecovery.submitting : t.expiredRecovery.submitInstapay}
                        variant="y"
                        size="lg"
                        onPress={handleSubmitInstapay}
                        loading={busy}
                        disabled={busy || uploading || !screenshotUrl}
                      />
                    </View>
                  </View>
                </>
              )}

              {PAID_UI_ENABLED && step === 'instapay-done' && (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <View style={styles.successCircle}>
                    <Ionicons name="checkmark" size={40} color={colors.white} />
                  </View>
                  <Text style={[styles.doneTitle, { marginTop: spacing.md }, dirStyle]}>
                    {t.expiredRecovery.instapayDoneTitle}
                  </Text>
                  <Text style={[styles.doneBody, { marginTop: spacing.sm }, dirStyle]}>
                    {t.expiredRecovery.instapayDoneBody}
                  </Text>
                  <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
                    <Button
                      label={t.expiredRecovery.close}
                      variant="y"
                      size="lg"
                      onPress={onClose}
                    />
                  </View>
                </View>
              )}

              {PAID_UI_ENABLED && step === 'mobile-wallet' && (
                <>

                  <MobileWalletCard
                    amount={amount}
                    walletNumber={paySettings.mobileWalletAccount || '—'}
                    walletName={paySettings.mobileWalletName}
                  />

                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={[styles.fieldLabel, dirStyle]}>
                      {t.expiredRecovery.screenshot}
                    </Text>
                    <Pressable
                      onPress={handlePickScreenshot}
                      disabled={uploading}
                      style={({ pressed }) => [
                        styles.uploadBox,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {screenshotLocal ? (
                        <Image
                          source={{ uri: screenshotLocal }}
                          style={styles.uploadPreview}
                        />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Ionicons name="cloud-upload-outline" size={28} color={colors.muted} />
                          <Text style={styles.uploadHint}>{t.expiredRecovery.screenshot}</Text>
                        </View>
                      )}
                      {uploading && (
                        <View style={styles.uploadOverlay}>
                          <ActivityIndicator color={colors.white} />
                        </View>
                      )}
                    </Pressable>
                  </View>

                  <Input
                    label={t.expiredRecovery.buyerPhone}
                    value={buyerPhone}
                    onChangeText={setBuyerPhone}
                    keyboardType="phone-pad"
                    placeholder={t.expiredRecovery.buyerPhonePlaceholder}
                    style={{ textAlign: 'left', writingDirection: 'ltr' }}
                  />

                  <View style={[styles.actionsRow, rowDir]}>
                    <View style={styles.actionCell}>
                      <Button
                        label={t.expiredRecovery.back}
                        variant="outline"
                        size="lg"
                        onPress={() => setStep('choice')}
                        disabled={busy || uploading}
                      />
                    </View>
                    <View style={styles.actionCell}>
                      <Button
                        label={busy ? t.expiredRecovery.submitting : t.expiredRecovery.submitMobileWallet}
                        variant="y"
                        size="lg"
                        onPress={handleSubmitMobileWallet}
                        loading={busy}
                        disabled={busy || uploading || !screenshotUrl}
                      />
                    </View>
                  </View>
                </>
              )}

              {PAID_UI_ENABLED && step === 'mobile-wallet-done' && (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <View style={styles.successCircle}>
                    <Ionicons name="checkmark" size={40} color={colors.white} />
                  </View>
                  <Text style={[styles.doneTitle, { marginTop: spacing.md }, dirStyle]}>
                    {t.expiredRecovery.mobileWalletDoneTitle}
                  </Text>
                  <Text style={[styles.doneBody, { marginTop: spacing.sm }, dirStyle]}>
                    {t.expiredRecovery.mobileWalletDoneBody}
                  </Text>
                  <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
                    <Button
                      label={t.expiredRecovery.close}
                      variant="y"
                      size="lg"
                      onPress={onClose}
                    />
                  </View>
                </View>
              )}

              {step === 'apple-iap' && (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <ActivityIndicator size="large" color={isDark ? colors.y : colors.dk} />
                  <Text style={[styles.doneBody, { marginTop: spacing.md }, dirStyle]}>
                    {t.expiredRecovery.appleProcessing}
                  </Text>
                </View>
              )}

              {step === 'apple-iap-done' && (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <View style={styles.successCircle}>
                    <Ionicons name="checkmark" size={40} color={colors.white} />
                  </View>
                  <Text style={[styles.doneTitle, { marginTop: spacing.md }, dirStyle]}>
                    {t.expiredRecovery.appleDoneTitle}
                  </Text>
                  <Text style={[styles.doneBody, { marginTop: spacing.sm }, dirStyle]}>
                    {t.expiredRecovery.appleDoneBody}
                  </Text>
                  <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>
                    <Button
                      label={t.expiredRecovery.close}
                      variant="y"
                      size="lg"
                      onPress={onClose}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function MethodCard({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  variant,
  rowDir,
  dirStyle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  iconColor: string
  title: string
  subtitle: string
  onPress: () => void
  variant?: 'purple' | 'green'
  rowDir: { direction: 'ltr'; flexDirection: 'row-reverse' } | null
  dirStyle: { writingDirection: 'rtl' | 'ltr'; textAlign: 'auto' }
}) {
  const { isDark } = useTheme()
  const styles = useStyles()
  const cardTint =
    variant === 'purple'
      ? isDark
        ? { backgroundColor: 'rgba(123,47,190,0.16)', borderColor: 'rgba(168,110,224,0.45)' }
        : { backgroundColor: '#F6EFFB', borderColor: '#D6BCEF' }
      : variant === 'green'
        ? isDark
          ? { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: '#10b981' }
          : { backgroundColor: '#ECFDF5', borderColor: '#10b981' }
        : null
  const iconTint =
    variant === 'purple'
      ? { backgroundColor: 'rgba(123,47,190,0.12)' }
      : variant === 'green'
        ? { backgroundColor: 'rgba(16,185,129,0.12)' }
        : null
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.methodCard,
        rowDir,
        cardTint,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.methodIconWrap, iconTint]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.methodTitle, dirStyle]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.methodSubtitle, dirStyle]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

function DetailRow({
  label,
  value,
  rowDir,
  dirStyle,
}: {
  label: string
  value: string
  rowDir: { direction: 'ltr'; flexDirection: 'row-reverse' } | null
  dirStyle: { writingDirection: 'rtl' | 'ltr'; textAlign: 'auto' }
}) {
  const styles = useStyles()
  return (
    <View style={[styles.detailRow, rowDir]}>
      <Text style={[styles.detailLabel, dirStyle]}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

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
    overflow: 'hidden',
    ...shadow.sl,
  },
  sheetHeader: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
    marginEnd: spacing.md,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.red,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.yellowBg,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.redBg,
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.heading,
    lineHeight: 20,
  },
  instapayBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: dark ? 'rgba(123,47,190,0.16)' : '#F6EFFB',
    borderWidth: 1,
    borderColor: dark ? 'rgba(168,110,224,0.45)' : '#D6BCEF',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  instapayBannerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: dark ? '#D8B9F5' : '#4A1E75',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.placeholder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.heading,
    writingDirection: 'ltr',
  },
  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.heading,
    marginBottom: spacing.xs,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    minHeight: 140,
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
  },
  uploadPlaceholder: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  uploadHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  uploadPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  actionCell: {
    flex: 1,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.heading,
    textAlign: 'center',
  },
  doneBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
})

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }
function useStyles() {
  return themedStyles[useTheme().mode]
}
