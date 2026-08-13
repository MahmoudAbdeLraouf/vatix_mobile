import React, { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  checkOtp,
  checkPhoneAvailable,
  getSiteSettings,
  registerClient,
  sendOtp,
} from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BottomTabBar } from '@/components/BottomTabBar'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { validatePassword } from '@/lib/password-policy'

type Step = 'form' | 'otp'

const STEP_ICONS: Record<Step, React.ComponentProps<typeof Ionicons>['name']> = {
  form: 'person-add-outline',
  otp: 'shield-checkmark-outline',
}

export default function SignupClientScreen() {
  const { t, isRtl, locale } = useLocale()
  const { login } = useAuth()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()

  const [step, setStep] = useState<Step>('form')
  const [otpEnabled, setOtpEnabled] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [code, setCode] = useState('')
  const codeRef = useRef<TextInput>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSiteSettings()
      .then(s => setOtpEnabled(s.otpVerificationEnabled))
      .catch(() => setOtpEnabled(true))
  }, [])

  const STEPS: Step[] = otpEnabled ? ['form', 'otp'] : ['form']

  async function registerAndLogin() {
    const response = await registerClient({
      phone: phone.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
    })
    await login(response, redirect)
  }

  async function handleNext() {
    setError('')
    if (!firstName.trim()) { setError(t.requiredField); return }
    if (!phone.trim()) { setError(t.requiredField); return }
    if (phone.trim().length < 11) { setError(t.invalidPhone); return }
    const pwd = validatePassword(password, locale)
    if (!pwd.valid) { setError(pwd.error!); return }
    if (password !== confirmPassword) { setError(t.passwordMismatch); return }

    setLoading(true)
    try {
      const { available } = await checkPhoneAvailable(phone.trim())
      if (!available) { setError(t.phoneTaken); setLoading(false); return }
      if (!otpEnabled) {
        await registerAndLogin()
        return
      }
      await sendOtp(phone.trim())
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.serverError)
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
      await registerAndLogin()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.serverError)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    try { await sendOtp(phone.trim()) } catch {}
  }

  function handleBack() {
    if (step === 'otp') { setCode(''); setError(''); setStep('form'); return }
    router.back()
  }

  const stepTitles: Record<Step, string> = {
    form: t.createClientAccount,
    otp: t.otpTitle,
  }
  const stepSubtitles: Record<Step, string> = {
    form: t.iAmClient,
    otp: `${t.otpSubtitle} ${phone}`,
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
          {step === 'form' && (
            <>
              <Input label={t.firstName} value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              <Input label={t.lastName} value={lastName} onChangeText={setLastName} autoCapitalize="words" />
              <Input label={t.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01xxxxxxxxx" />
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
    paddingBottom: spacing.xxl * 2,
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
})
