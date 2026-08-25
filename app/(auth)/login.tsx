import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { isExpiredLogin, loginUser, type ExpiredLoginResponse } from '@/lib/api'
import { authErrorMessage } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BottomTabBar } from '@/components/BottomTabBar'
import { ExpiredStoreDialog } from '@/components/ExpiredStoreDialog'
import { colors, fonts, radius, spacing } from '@/constants/theme'

export default function LoginScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const { login } = useAuth()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const dirStyle = { writingDirection: isRtl ? 'rtl' as const : 'ltr' as const }

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState<{
    res: ExpiredLoginResponse
    phone: string
    password: string
  } | null>(null)

  async function handleLogin() {
    setError('')
    if (!phone.trim()) { setError(t.requiredField); return }
    if (!password) { setError(t.requiredField); return }

    setLoading(true)
    try {
      const response = await loginUser(phone.trim(), password)
      if (isExpiredLogin(response)) {
        setExpired({ res: response, phone: phone.trim(), password })
        return
      }
      await login(response, redirect)
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setLoading(false)
    }
  }

  function goGuest() {
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('/(auth)')) {
      router.replace(redirect as never)
    } else {
      router.replace('/(tabs)/home')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      enabled={Platform.OS === 'ios'}
    >
      <SafeAreaView style={[styles.flex, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
        {/* Hero */}
        <View style={styles.hero}>
          {/* Decorative circles */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />

          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            >
              <Ionicons
                name={isRtl ? 'arrow-forward-outline' : 'arrow-back-outline'}
                size={20}
                color={colors.white}
              />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              >
                <Ionicons name="globe-outline" size={20} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push('/dashboard/messages')}
              >
                <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push('/dashboard/notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.heroTitle, dirStyle]}>{t.loginTitle}</Text>
          <Text style={[styles.heroSubtitle, dirStyle]}>{t.loginSubtitle}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
              rightIcon={
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.g500}
                />
              }
              onRightIconPress={() => setShowPass(v => !v)}
            />

            {/* TODO: Re-enable once backend /auth/reset-password is re-enabled (SMS provider + signed-token flow). See VATIX-BACKEND-4.
            <Pressable style={styles.forgot} onPress={() => router.push('/(auth)/forgot')}>
              <Text style={[styles.forgotText, dirStyle]}>{t.forgotPassword}</Text>
            </Pressable>
            */}

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#C53030" />
                <Text style={[styles.errorText, dirStyle]}>{error}</Text>
              </View>
            )}

            <Button label={t.login} onPress={handleLogin} loading={loading} />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={[styles.dividerText, dirStyle]}>{t.or ?? 'أو'}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, dirStyle]}>{t.dontHaveAccount} </Text>
              <Link
                href={redirect ? { pathname: '/(auth)/register', params: { redirect } } : '/(auth)/register'}
                asChild
              >
                <Pressable>
                  <Text style={[styles.link, dirStyle]}>{t.register}</Text>
                </Pressable>
              </Link>
            </View>

            <Pressable style={styles.guestBtn} onPress={goGuest}>
              <Text style={[styles.guestText, dirStyle]}>{t.continueAsGuest}</Text>
            </Pressable>
          </ScrollView>
        </View>

        <BottomTabBar />

        {expired && (
          <ExpiredStoreDialog
            visible
            phone={expired.phone}
            password={expired.password}
            storeType={expired.res.storeType}
            onClose={() => setExpired(null)}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.dk },

  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },

  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  circle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.y,
    opacity: 0.06,
    top: -60,
    start: -60,
  },
  circle2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.y,
    opacity: 0.05,
    top: 20,
    end: -40,
  },
  circle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white,
    opacity: 0.04,
    bottom: 10,
    start: 30,
  },

  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 28,
    color: colors.white,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  forgot: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  forgotText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.y,
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

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.g200,
  },
  dividerText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g400,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.y,
  },

  guestBtn: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  guestText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g500,
    textDecorationLine: 'underline',
  },
})
