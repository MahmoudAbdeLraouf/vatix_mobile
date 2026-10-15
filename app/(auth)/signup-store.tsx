import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Sentry from '@sentry/react-native'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  checkOtp,
  checkPhoneAvailable,
  getSiteSettings,
  registerStore,
  sendOtp,
  uploadPublic,
} from '@/lib/api'
import { authErrorMessage } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BottomTabBar } from '@/components/BottomTabBar'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { validatePassword } from '@/lib/password-policy'

type Step = 'phone' | 'otp' | 'info'

const STEP_ICONS: Record<Step, React.ComponentProps<typeof Ionicons>['name']> = {
  phone: 'call-outline',
  otp: 'shield-checkmark-outline',
  info: 'storefront-outline',
}

export default function SignupStoreScreen() {
  const { t, isRtl, locale } = useLocale()
  const { login } = useAuth()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()

  const [step, setStep] = useState<Step>('phone')
  // null = settings not loaded yet. The OTP step stays hidden unless OTP is
  // confirmed on; when unknown, the /auth/verify/send response decides
  // (the backend answers 'skipped' when verification is disabled).
  const [otpEnabled, setOtpEnabled] = useState<boolean | null>(null)

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [code, setCode] = useState('')
  const codeRef = useRef<TextInput>(null)

  const [storeName, setStoreName] = useState('')
  const [description, setDescription] = useState('')
  // Pick-time URI is kept for the preview thumbnail only. The authoritative
  // value is the uploaded MinIO URL — picker-cache URIs get evicted between
  // pick and submit, which produced intermittent "logo is required" errors.
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSiteSettings()
      .then(s => setOtpEnabled(s.otpVerificationEnabled))
      .catch(() => {})
  }, [])

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t.permissionRequired, t.allowPhotoAccess)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    setLogoUri(asset.uri)
    setLogoUrl(null)
    setLogoUploading(true)
    setError('')
    Sentry.addBreadcrumb({
      category: 'upload',
      level: 'info',
      message: '[signup-store] logo picked',
      data: {
        uriScheme: asset.uri?.split(':')[0] ?? null,
        mimeType,
        width: asset.width,
        height: asset.height,
      },
    })
    try {
      const url = await uploadPublic(asset.uri, mimeType)
      setLogoUrl(url)
    } catch (e: unknown) {
      Sentry.captureMessage('[signup-store] logo upload failed', {
        level: 'warning',
        extra: { message: (e as Error)?.message ?? String(e) },
      })
      setLogoUri(null)
      setError(authErrorMessage(e, t))
    } finally {
      setLogoUploading(false)
    }
  }

  async function pickCover() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t.permissionRequired, t.allowPhotoAccess)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [4, 1],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    setCoverUri(asset.uri)
    setCoverUrl(null)
    setCoverUploading(true)
    setError('')
    try {
      const url = await uploadPublic(asset.uri, mimeType)
      setCoverUrl(url)
    } catch (e: unknown) {
      Sentry.captureMessage('[signup-store] cover upload failed', {
        level: 'warning',
        extra: { message: (e as Error)?.message ?? String(e) },
      })
      setCoverUri(null)
      setError(authErrorMessage(e, t))
    } finally {
      setCoverUploading(false)
    }
  }

  const STEPS: Step[] = otpEnabled ? ['phone', 'otp', 'info'] : ['phone', 'info']

  async function handleNext() {
    setError('')
    if (!phone.trim()) { setError(t.requiredField); return }
    if (phone.trim().length < 11) { setError(t.invalidPhone); return }
    const pwd = validatePassword(password, locale)
    if (!pwd.valid) { setError(pwd.error!); return }
    if (password !== confirmPassword) { setError(t.passwordMismatch); return }

    setLoading(true)
    try {
      const { available } = await checkPhoneAvailable(phone.trim())
      if (!available) { setError(t.phoneTaken); setLoading(false); return }
      let enabled = otpEnabled
      if (enabled !== false) {
        const { status } = await sendOtp(phone.trim())
        enabled = status !== 'skipped'
        setOtpEnabled(enabled)
      }
      setStep(enabled ? 'otp' : 'info')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    setError('')
    if (code.length < 4) { setError(t.requiredField); return }
    setLoading(true)
    try {
      const { verified } = await checkOtp(phone.trim(), code)
      if (!verified) { setError(t.invalidPhone); return }
      setStep('info')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setError('')
    if (!storeName.trim()) { setError(t.requiredField); return }
    if (logoUploading || coverUploading) {
      setError(isRtl ? 'جاري رفع الصورة، يرجى الانتظار' : 'Image upload in progress, please wait')
      return
    }
    if (!logoUrl) { setError(isRtl ? 'يرجى اختيار شعار المتجر' : 'Please choose a store logo'); return }
    setLoading(true)
    try {
      const response = await registerStore({
        phone: phone.trim(),
        password,
        type: 'store',
        storeName: storeName.trim(),
        description: description.trim() || undefined,
        logo: logoUrl,
        ...(coverUrl ? { cover: coverUrl } : {}),
      })
      await login(response, redirect)
      void track({ name: 'sign_up', params: { method: 'phone', user_type: 'store' } })
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    try { await sendOtp(phone.trim()) } catch {}
  }

  function handleBack() {
    if (step === 'otp') { setCode(''); setError(''); setStep('phone'); return }
    if (step === 'info') { setError(''); setStep(otpEnabled ? 'otp' : 'phone'); return }
    router.back()
  }

  const stepTitles: Record<Step, string> = {
    phone: t.createStoreAccount,
    otp: t.otpTitle,
    info: t.iAmStore,
  }
  const stepSubtitles: Record<Step, string> = {
    phone: t.iAmStore,
    otp: `${t.otpSubtitle} ${phone}`,
    info: t.createStoreAccount,
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { direction: isRtl ? 'rtl' : 'ltr' }]}
      behavior="padding"
      enabled={Platform.OS === 'ios'}
    >
      <View style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back-outline" size={22} color="rgba(255,255,255,0.75)" />
        </Pressable>

        <View style={styles.stepIconWrap}>
          <Ionicons name={STEP_ICONS[step]} size={30} color={colors.dk} />
        </View>

        <Text style={styles.heroTitle}>{stepTitles[step]}</Text>
        <Text style={styles.heroSubtitle}>{stepSubtitles[step]}</Text>

        <View style={styles.stepDots}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.dot,
                s === step && styles.dotActive,
                STEPS.indexOf(step) > i && styles.dotDone,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'phone' && (
            <>
              <Input
                label={t.phone}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="01xxxxxxxxx"
                // Phone numbers render LTR regardless of UI locale.
                style={{ textAlign: 'left', writingDirection: 'ltr' }}
              />
              <Input
                label={t.password}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                rightIcon={<Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.g500} />}
                onRightIconPress={() => setShowPass(v => !v)}
              />
              <Input
                label={t.confirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
              />
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#C53030" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <Button label={t.next} onPress={handleNext} loading={loading} />
            </>
          )}

          {step === 'otp' && (
            <>
              <Pressable style={styles.codeBox} onPress={() => codeRef.current?.focus()}>
                <Text style={styles.codeText}>{code || '------'}</Text>
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.hiddenInput}
                  autoFocus
                />
              </Pressable>
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#C53030" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <Button label={t.verify} onPress={handleVerify} loading={loading} />
              <Pressable style={styles.resendBtn} onPress={handleResend}>
                <Text style={styles.resendText}>{t.resendCode}</Text>
              </Pressable>
            </>
          )}

          {step === 'info' && (
            <>
              <Input label={t.storeName} value={storeName} onChangeText={setStoreName} autoCapitalize="words" />

              <Text style={styles.sectionLabel}>{t.storeDescription}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={styles.textarea}
              />

              <Text style={styles.sectionLabel}>{t.storeLogo} *</Text>
              <View style={styles.logoRow}>
                <Pressable
                  style={styles.logoPreview}
                  onPress={pickLogo}
                  disabled={logoUploading}
                >
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logoImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={26} color={colors.g400} />
                  )}
                  {logoUploading ? (
                    <View style={styles.logoOverlay}>
                      <ActivityIndicator color={colors.dk} />
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.logoControls}>
                  <Button
                    label={
                      logoUploading
                        ? (isRtl ? 'جاري الرفع...' : 'Uploading...')
                        : logoUrl
                          ? (isRtl ? 'تغيير الصورة' : 'Change')
                          : (isRtl ? '+ اختر صورة' : '+ Choose image')
                    }
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    loading={logoUploading}
                    disabled={logoUploading}
                    onPress={pickLogo}
                  />
                  {logoUrl && !logoUploading ? (
                    <Pressable
                      onPress={() => { setLogoUri(null); setLogoUrl(null) }}
                      hitSlop={6}
                    >
                      <Text style={styles.removeText}>{isRtl ? 'حذف الصورة' : 'Remove image'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#C53030" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <Button label={t.createStoreAccount} onPress={handleSubmit} loading={loading} />
            </>
          )}
        </ScrollView>
      </View>

      <BottomTabBar />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.dk },

  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.xxl,
    start: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: colors.y,
    width: 20,
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  codeBox: {
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.g100,
  },
  codeText: {
    fontFamily: fonts.black,
    fontSize: 32,
    color: colors.dk,
    letterSpacing: 8,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#C53030',
  },

  resendBtn: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.y,
  },

  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textAlign: 'auto',
  },



  textarea: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: colors.g300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.dk,
    marginBottom: spacing.md,
    textAlign: 'auto',
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: spacing.md,
  },
  logoPreview: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.g100,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoControls: {
    flex: 1,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  removeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
})
