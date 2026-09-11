import React from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { Button } from '@/components/ui/Button'
import { BottomTabBar } from '@/components/BottomTabBar'
import { colors, fonts, radius, spacing } from '@/constants/theme'

export default function SignInRequiredScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const dirStyle = { writingDirection: isRtl ? 'rtl' as const : 'ltr' as const }

  const safeRedirect =
    redirect && redirect.startsWith('/') && !redirect.startsWith('/(auth)')
      ? redirect
      : undefined

  function goLogin() {
    router.push(
      safeRedirect
        ? { pathname: '/(auth)/login', params: { redirect: safeRedirect } }
        : '/(auth)/login',
    )
  }

  function goRegister() {
    router.push(
      safeRedirect
        ? { pathname: '/(auth)/register', params: { redirect: safeRedirect } }
        : '/(auth)/register',
    )
  }

  function goCancel() {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/home')
    }
  }

  return (
    <SafeAreaView style={[styles.flex, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
      <View style={styles.hero}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />

        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={goCancel}>
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
          </View>
        </View>

        <View style={styles.lockWrap}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.dk} />
        </View>

        <Text style={[styles.heroTitle, dirStyle]}>{t.loginRequired}</Text>
        <Text style={[styles.heroSubtitle, dirStyle]}>{t.loginToAccess}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.actions}>
          <Button label={t.login} onPress={goLogin} variant="y" />
          <Button label={t.register} onPress={goRegister} variant="outline" />

          <Pressable style={styles.cancelBtn} onPress={goCancel}>
            <Text style={[styles.cancelText, dirStyle]}>{t.cancel}</Text>
          </Pressable>
        </View>
      </View>

      <BottomTabBar />
    </SafeAreaView>
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

  lockWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.white,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  cancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g500,
    textDecorationLine: 'underline',
  },
})
