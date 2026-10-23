import React from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Redirect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { Logo } from '@/components/ui/Logo'
import { MessagesBell } from '@/components/MessagesBell'
import { NotificationBell } from '@/components/NotificationBell'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

interface Props {
  title?: string
  children: React.ReactNode
  scroll?: boolean
  contentPadding?: boolean
  bottomBar?: React.ReactNode
}

export function DashboardLayout({ title, children, scroll = true, contentPadding = true, bottomBar }: Props) {
  const { user, isAuthenticated, loading } = useAuth()
  const { t, isRtl, locale, setLocale } = useLocale()
  const dirText = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: isRtl ? ('right' as const) : ('left' as const),
  }
  const dirContainer = isRtl ? { direction: 'rtl' as const } : null
  const insets = useSafeAreaInsets()

  // Sub-pages are reached from the More tab, so fall back there on a cold deep link.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))

  const displayName = user?.displayName || t.profile

  if (loading) return null
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  const Body = scroll ? (
    <ScrollView
      style={[styles.body, dirContainer]}
      contentContainerStyle={[
        contentPadding && styles.bodyPadding,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, dirContainer, contentPadding && styles.bodyPadding]}>{children}</View>
  )

  return (
    <SafeAreaView style={[styles.safe, dirContainer]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.dk} />

      {/* TOPBAR */}
      <View style={[styles.topbar, dirContainer]}>
        <Pressable
          onPress={goBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t.back}
          style={styles.iconBtn}
        >
          <Ionicons name={isRtl ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.white} />
        </Pressable>

        <Pressable onPress={() => router.push('/(tabs)/home')} style={styles.brand}>
          <Logo size="sm" />
          <View style={styles.divider} />
          <Text style={[styles.brandTitle, dirText]} numberOfLines={1}>
            {title ?? t.dashboard}
          </Text>
        </Pressable>

        <View style={styles.topRight}>
          <MessagesBell color={colors.white} />
          <Pressable
            onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.language}
            style={styles.topIconBtn}
          >
            <Ionicons name="globe-outline" size={22} color={colors.white} />
            <Text style={styles.langCode}>{locale === 'ar' ? 'EN' : 'ع'}</Text>
          </Pressable>
          <NotificationBell color={colors.white} />
          <Pressable
            onPress={() => router.push('/dashboard/profile')}
            hitSlop={6}
            style={styles.avatarBtn}
            accessibilityRole="button"
            accessibilityLabel={t.profile}
          >
            <AvatarCircle name={displayName} size={32} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior="padding"
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={insets.top + 52}
      >
        {Body}
      </KeyboardAvoidingView>

      {bottomBar}
    </SafeAreaView>
  )
}

function AvatarCircle({ name, size, uri }: { name: string; size: number; uri?: string }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join('')
    .toUpperCase()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.dk,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            color: colors.white,
            fontFamily: fonts.bold,
            fontSize: size * 0.4,
          }}
        >
          {initials || '?'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dk,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.dk,
    ...Platform.select({
      ios: shadow.ss,
      android: { ...shadow.ss, elevation: 2 },
    }),
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  brandTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langCode: {
    position: 'absolute',
    bottom: 1,
    end: 2,
    fontFamily: fonts.bold,
    fontSize: 8,
    color: colors.dk,
    backgroundColor: colors.y,
    borderRadius: radius.full,
    paddingHorizontal: 3,
    lineHeight: 10,
    minWidth: 12,
    textAlign: 'center',
  },
  avatarBtn: {
    padding: 2,
  },
  body: {
    flex: 1,
    backgroundColor: colors.g100,
  },
  bodyPadding: {
    padding: spacing.md,
  },
})
