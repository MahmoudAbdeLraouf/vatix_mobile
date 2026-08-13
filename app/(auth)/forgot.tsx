import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { sendOtp, resetPassword } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { colors, fonts, radius, spacing } from '@/constants/theme'
import { validatePassword } from '@/lib/password-policy'

type Step = 'phone' | 'otp' | 'password'

const STEP_ICONS: Record<Step, React.ComponentProps<typeof Ionicons>['name']> = {
  phone: 'call-outline',
  otp: 'shield-checkmark-outline',
  password: 'lock-closed-outline',
}

export default function ForgotScreen() {
  const { t, locale } = useLocale()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp() {
    setError('')
    if (!phone.trim()) { setError(t.requiredField); return }
    setLoading(true)
    try {
      await sendOtp(phone.trim())
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.serverError)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setError('')
    if (code.length < 4) { setError(t.requiredField); return }
    setStep('password')
  }

  async function handleReset() {
    setError('')
    if (!newPassword) { setError(t.requiredField); return }
    const pwd = validatePassword(newPassword, locale)
    if (!pwd.valid) { setError(pwd.error!); return }
    if (newPassword !== confirmPassword) { setError(t.passwordMismatch); return }
    setLoading(true)
    try {
      await resetPassword(phone.trim(), code, newPassword)
      router.replace('/(auth)/login')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.serverError)
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    if (step === 'otp') { setStep('phone'); return }
    if (step === 'password') { setStep('otp'); return }
    router.back()
  }

  const stepTitles: Record<Step, string> = {
    phone: t.forgotPasswordTitle,
    otp: t.otpTitle,
    password: t.resetPassword,
  }
  const stepSubtitles: Record<Step, string> = {
    phone: t.forgotPasswordSubtitle,
    otp: `${t.otpSubtitle} ${phone}`,
    password: t.forgotPasswordSubtitle,
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      enabled={Platform.OS === 'ios'}
    >
      {/* Navy hero */}
      <View style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back-outline" size={22} color="rgba(255,255,255,0.75)" />
        </Pressable>
        <View style={styles.stepIconWrap}>
          <Ionicons name={STEP_ICONS[step]} size={32} color={colors.dk} />
        </View>
        <Logo size="sm" light />
        <Text style={styles.heroTitle}>{stepTitles[step]}</Text>
        <Text style={styles.heroSubtitle}>{stepSubtitles[step]}</Text>
      </View>

      {/* White card */}
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
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button label={t.next} onPress={handleSendOtp} loading={loading} />
            </>
          )}

          {step === 'otp' && (
            <>
              <Input
                label={t.otpCode}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="------"
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button label={t.verify} onPress={handleVerifyOtp} loading={loading} />
              <Pressable style={styles.resendBtn} onPress={handleSendOtp}>
                <Text style={styles.link}>{t.resendCode}</Text>
              </Pressable>
            </>
          )}

          {step === 'password' && (
            <>
              <Input
                label={t.newPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPass}
                rightIcon={
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.g500}
                  />
                }
                onRightIconPress={() => setShowPass(v => !v)}
              />
              <Input
                label={t.confirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button label={t.resetPassword} onPress={handleReset} loading={loading} />
            </>
          )}
        </ScrollView>
      </View>
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
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
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

  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.y,
  },
})
