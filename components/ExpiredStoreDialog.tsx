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
import {
  BillingCycle,
  expiredConvertToClient,
  expiredPayInstapay,
  expiredPayMobileWallet,
  getSiteSettings,
  uploadPublic,
} from '@/lib/api'
import { authErrorMessage } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { IS_IOS, PAID_UI_ENABLED } from '@/lib/platform'

// Display fallback amounts — the backend is the source of truth at insert time
// (resolves the SubscriptionPlan row by { storeType, billingCycle }). These
// values just prime the QR / wallet cards while the user picks a cycle.
const AMOUNT_BY_TYPE_CYCLE: Record<'store' | 'store_plus', Record<BillingCycle, number>> = {
  store: { monthly: 300, yearly: 3000 },
  store_plus: { monthly: 500, yearly: 5000 },
}

type Step =
  | 'choice'
  | 'convert-confirm'
  | 'instapay'
  | 'instapay-done'
  | 'mobile-wallet'
  | 'mobile-wallet-done'

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
  storeType: 'store' | 'store_plus'
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

export function ExpiredStoreDialog({ visible, phone, password, storeType, onClose }: Props) {
  const { t } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const auth = useAuth()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState<Step>('choice')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotLocal, setScreenshotLocal] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [buyerPhone, setBuyerPhone] = useState('')
  const [paySettings, setPaySettings] = useState<PaySettings>(DEFAULT_PAY_SETTINGS)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  const amount = AMOUNT_BY_TYPE_CYCLE[storeType][cycle]
  const showCyclePicker = storeType === 'store_plus' && !IS_IOS

  useEffect(() => {
    if (!visible) return
    setStep('choice')
    setError('')
    setBusy(false)
    setScreenshotUrl(null)
    setScreenshotLocal(null)
    setBuyerPhone('')
    setCycle('monthly')
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
      await expiredPayInstapay(phone, password, screenshotUrl, buyerPhone.trim(), cycle)
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
      await expiredPayMobileWallet(phone, password, screenshotUrl, buyerPhone.trim(), cycle)
      setStep('mobile-wallet-done')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
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

                  <MethodCard
                    icon="person-outline"
                    iconColor={colors.dk}
                    title={t.expiredRecovery.optionConvertTitle}
                    subtitle={t.expiredRecovery.optionConvertDesc}
                    onPress={() => setStep('convert-confirm')}
                    rowDir={rowDir}
                    dirStyle={dirStyle}
                  />
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
                  {showCyclePicker && (
                    <CyclePicker
                      cycle={cycle}
                      onChange={setCycle}
                      disabled={busy || uploading}
                      t={t}
                      dirStyle={dirStyle}
                    />
                  )}

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
                          <Ionicons name="cloud-upload-outline" size={28} color={colors.g500} />
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
                  {showCyclePicker && (
                    <CyclePicker
                      cycle={cycle}
                      onChange={setCycle}
                      disabled={busy || uploading}
                      t={t}
                      dirStyle={dirStyle}
                    />
                  )}

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
                          <Ionicons name="cloud-upload-outline" size={28} color={colors.g500} />
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
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function CyclePicker({
  cycle,
  onChange,
  disabled,
  t,
  dirStyle,
}: {
  cycle: BillingCycle
  onChange: (c: BillingCycle) => void
  disabled: boolean
  t: ReturnType<typeof useLocale>['t']
  dirStyle: { writingDirection: 'rtl' | 'ltr'; textAlign: 'auto' }
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, dirStyle]}>{t.billingCycleLabel}</Text>
      <View style={styles.typeGrid}>
        <Pressable
          onPress={() => onChange('monthly')}
          disabled={disabled}
          style={[
            styles.typeCard,
            cycle === 'monthly' && { borderColor: colors.y, backgroundColor: colors.yl },
            disabled && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.typeIcon}>🗓️</Text>
          <Text style={styles.typeLabel}>{t.monthlyBilling}</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('yearly')}
          disabled={disabled}
          style={[
            styles.typeCard,
            cycle === 'yearly' && { borderColor: colors.y, backgroundColor: colors.yl },
            disabled && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.typeIcon}>📅</Text>
          <Text style={styles.typeLabel}>{t.yearlyBilling}</Text>
        </Pressable>
      </View>
    </View>
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
  const cardTint =
    variant === 'purple'
      ? { backgroundColor: '#F6EFFB', borderColor: '#D6BCEF' }
      : variant === 'green'
        ? { backgroundColor: '#ECFDF5', borderColor: '#10b981' }
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
  return (
    <View style={[styles.detailRow, rowDir]}>
      <Text style={[styles.detailLabel, dirStyle]}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

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
    overflow: 'hidden',
    ...shadow.sl,
  },
  sheetHeader: {
    backgroundColor: colors.dk,
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
    color: colors.g600,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.rl,
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
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  methodSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
    marginTop: 2,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.rl,
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.dk,
    lineHeight: 20,
  },
  instapayBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#F6EFFB',
    borderWidth: 1,
    borderColor: '#D6BCEF',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  instapayBannerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#4A1E75',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.g100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
    writingDirection: 'ltr',
  },
  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    gap: 4,
  },
  typeIcon: {
    fontSize: 22,
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    minHeight: 140,
    overflow: 'hidden',
    backgroundColor: colors.g100,
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
    color: colors.g500,
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
    color: colors.dk,
    textAlign: 'center',
  },
  doneBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    textAlign: 'center',
    lineHeight: 22,
  },
})
