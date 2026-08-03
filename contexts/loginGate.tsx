import React, { createContext, useCallback, useContext, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

interface LoginGateContextValue {
  /** Returns true if user is authenticated. Otherwise opens the modal and returns false. */
  requireLogin: () => boolean
}

const LoginGateContext = createContext<LoginGateContextValue | null>(null)

export function LoginGateProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { t, isRtl } = useLocale()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  const requireLogin = useCallback((): boolean => {
    if (isAuthenticated) return true
    setVisible(true)
    return false
  }, [isAuthenticated])

  const close = useCallback(() => setVisible(false), [])

  const goToLogin = useCallback(() => {
    setVisible(false)
    const safe =
      pathname && pathname.startsWith('/') && !pathname.startsWith('/(auth)')
        ? { pathname: '/(auth)/login' as const, params: { redirect: pathname } }
        : ('/(auth)/login' as const)
    router.push(safe as never)
  }, [pathname])

  return (
    <LoginGateContext.Provider value={{ requireLogin }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.card, { direction: isRtl ? 'rtl' : 'ltr' }]}
            onPress={() => {}}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed" size={30} color={colors.dk} />
            </View>

            <Text style={styles.title}>{t.loginRequired}</Text>
            <Text style={styles.subtitle}>{t.loginToAccess}</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={goToLogin}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Ionicons name="log-in-outline" size={18} color={colors.dk} />
                <Text style={styles.primaryLabel}>{t.login}</Text>
              </Pressable>

              <Pressable
                onPress={close}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.secondaryLabel}>{t.cancel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </LoginGateContext.Provider>
  )
}

export function useLoginGate(): LoginGateContextValue {
  const ctx = useContext(LoginGateContext)
  if (!ctx) throw new Error('useLoginGate must be used within LoginGateProvider')
  return ctx
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadow.sl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.dk,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.y,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  primaryLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
  },
  secondaryLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g500,
  },
})
