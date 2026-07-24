import React, { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { checkOtp, sendOtp } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { colors, fonts, radius, spacing } from '@/constants/theme'

export default function OtpScreen() {
  const { t, isRtl } = useLocale()
  const { phone, redirect } = useLocalSearchParams<{ phone: string; redirect?: string }>()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<TextInput>(null)

  async function handleVerify() {
    if (code.length < 4) { setError(t.requiredField); return }
    setError('')
    setLoading(true)
    try {
      const { verified } = await checkOtp(phone ?? '', code)
      if (verified) {
        const target =
          redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/(auth)')
            ? redirect
            : '/(tabs)/home'
        router.replace(target as never)
      } else {
        setError(t.invalidPhone)
      }
    } catch {
      setError(t.serverError)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!phone) return
    setResending(true)
    try {
      await sendOtp(phone)
    } finally {
      setResending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { direction: isRtl ? 'rtl' : 'ltr' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Navy hero */}
      <View style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color="rgba(255,255,255,0.75)" />
        </Pressable>
        <Logo size="lg" light />
        <Text style={styles.heroTitle}>{t.otpTitle}</Text>
        <Text style={styles.heroSubtitle}>{t.otpSubtitle} {phone}</Text>
      </View>

      {/* White card */}
      <View style={styles.card}>
        <Pressable style={styles.codeBox} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.codeText}>{code || '------'}</Text>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.hiddenInput}
            autoFocus
          />
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button label={t.verify} onPress={handleVerify} loading={loading} />

        <Pressable style={styles.resend} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>{t.resendCode}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.dk },

  hero: {
    alignItems: 'center',
    gap: spacing.sm,
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
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.white,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
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

  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  resend: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.y,
  },
})
