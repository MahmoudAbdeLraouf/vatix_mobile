import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Redirect, router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { Logo } from '@/components/ui/Logo'
import { MessagesBell } from '@/components/MessagesBell'
import { NotificationBell } from '@/components/NotificationBell'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type NavKind = 'all' | 'clientOnly' | 'storeOnly' | 'storePlusOnly' | 'storeAnyOnly'

interface NavItem {
  href: string
  labelKey: keyof ReturnType<typeof useLocale>['t']
  icon: React.ComponentProps<typeof Ionicons>['name']
  emoji: string
  kind: NavKind
  badgeKey?: 'unread'
}

const NAV: NavItem[] = [
  { href: '/(tabs)/dashboard',       labelKey: 'dashboardHome', icon: 'grid-outline',            emoji: '🏠', kind: 'all' },
  { href: '/dashboard/profile',      labelKey: 'profile',       icon: 'person-outline',          emoji: '👤', kind: 'all' },
  { href: '/dashboard/store',        labelKey: 'storeInfo',     icon: 'storefront-outline',      emoji: '🏪', kind: 'storeAnyOnly' },
  { href: '/dashboard/social',       labelKey: 'socialMedia',   icon: 'logo-instagram',          emoji: '📱', kind: 'storeAnyOnly' },
  { href: '/dashboard/branches',     labelKey: 'branches',      icon: 'business-outline',        emoji: '🏢', kind: 'storePlusOnly' },
  { href: '/dashboard/messages',     labelKey: 'messages',      icon: 'chatbubble-outline',      emoji: '💬', kind: 'all', badgeKey: 'unread' },
  { href: '/dashboard/my-ads',       labelKey: 'myAds',         icon: 'list-outline',            emoji: '📋', kind: 'all' },
  { href: '/dashboard/favorites',    labelKey: 'favorites',     icon: 'heart-outline',           emoji: '❤️', kind: 'all' },
  { href: '/dashboard/following',    labelKey: 'following',     icon: 'people-outline',          emoji: '🏬', kind: 'all' },
  { href: '/dashboard/promote',      labelKey: 'promote',       icon: 'star-outline',            emoji: '⭐', kind: 'all' },
  { href: '/dashboard/subscription', labelKey: 'subscription',  icon: 'diamond-outline',         emoji: '💎', kind: 'all' },
  { href: '/dashboard/wallet',       labelKey: 'wallet',        icon: 'wallet-outline',          emoji: '💰', kind: 'all' },
  { href: '/dashboard/invoices',     labelKey: 'invoices',      icon: 'receipt-outline',         emoji: '🧾', kind: 'all' },
  { href: '/dashboard/analytics',    labelKey: 'analytics',     icon: 'stats-chart-outline',     emoji: '📊', kind: 'all' },
  { href: '/dashboard/settings',     labelKey: 'settings',      icon: 'settings-outline',        emoji: '⚙️', kind: 'all' },
]

function normalizeType(t: string | null | undefined): 'client' | 'store' | 'store_plus' | 'admin' | 'unknown' {
  if (!t) return 'unknown'
  const v = t.toLowerCase()
  if (v === 'client') return 'client'
  if (v === 'store') return 'store'
  if (v === 'store_plus') return 'store_plus'
  if (v === 'admin') return 'admin'
  return 'unknown'
}

interface Props {
  title?: string
  children: React.ReactNode
  scroll?: boolean
  contentPadding?: boolean
  bottomBar?: React.ReactNode
}

export function DashboardLayout({ title, children, scroll = true, contentPadding = true, bottomBar }: Props) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const { t, isRtl, locale, setLocale } = useLocale()
  const pathname = usePathname()
  const dirText = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: isRtl ? ('right' as const) : ('left' as const),
  }
  const dirContainer = isRtl ? { direction: 'rtl' as const } : null
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const drawerX = useRef(new Animated.Value(0)).current

  const drawerWidth = Math.min(320, width * 0.86)

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return
    }
    let cancelled = false
    const fetchUnread = async () => {
      const res = await authFetch<{ count: number }>('/conversations/unread-count')
      if (!cancelled && res) setUnread(res.count ?? 0)
    }
    fetchUnread()
    const id = setInterval(fetchUnread, 30_000)
    // Refresh immediately on foreground push arrival so the chat badge doesn't wait for the 30s poll.
    const sub = Notifications.addNotificationReceivedListener(() => {
      fetchUnread()
    })
    return () => {
      cancelled = true
      clearInterval(id)
      sub.remove()
    }
  }, [isAuthenticated])

  useEffect(() => {
    Animated.timing(drawerX, {
      toValue: drawerOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [drawerOpen, drawerX])

  const userType = normalizeType(user?.type)
  const isClient = userType === 'client'
  const isStore = userType === 'store'
  const isStorePlus = userType === 'store_plus'
  const isStoreAny = isStore || isStorePlus

  const nav = useMemo(
    () =>
      NAV.filter((n) => {
        switch (n.kind) {
          case 'all':
            return true
          case 'clientOnly':
            return isClient
          case 'storeOnly':
            return isStore
          case 'storePlusOnly':
            return isStorePlus
          case 'storeAnyOnly':
            return isStoreAny
          default:
            return true
        }
      }),
    [isClient, isStore, isStorePlus, isStoreAny],
  )

  const isActive = (href: string) => {
    if (href === '/(tabs)/dashboard') {
      return pathname === '/dashboard' || pathname === '/(tabs)/dashboard'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const go = (href: string) => {
    setDrawerOpen(false)
    setTimeout(() => router.push(href as any), 60)
  }

  const displayName = user?.displayName || t.profile
  const phone = user?.phone || ''
  const badge = isStorePlus
    ? { text: `⭐ ${t.storePlusPlan}`, bg: colors.y, fg: colors.dk }
    : isStore
    ? { text: `🏪 ${t.storeTypeStore}`, bg: colors.dk, fg: colors.white }
    : isClient
    ? { text: locale === 'ar' ? '👤 مستخدم' : '👤 User', bg: colors.g200, fg: colors.dk }
    : { text: '', bg: 'transparent', fg: colors.dk }

  const translateX = drawerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  })
  const backdropOpacity = drawerX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  })

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
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* TOPBAR */}
      <View style={[styles.topbar, dirContainer]}>
        <Pressable
          onPress={() => setDrawerOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t.menu}
          style={styles.iconBtn}
        >
          <Ionicons name="menu" size={24} color={colors.dk} />
        </Pressable>

        <Pressable onPress={() => router.push('/(tabs)/home')} style={styles.brand}>
          <Logo size="sm" />
          <View style={styles.divider} />
          <Text style={[styles.brandTitle, dirText]} numberOfLines={1}>
            {title ?? t.dashboard}
          </Text>
        </Pressable>

        <View style={styles.topRight}>
          <MessagesBell />
          <Pressable
            onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.language}
            style={styles.topIconBtn}
          >
            <Ionicons name="globe-outline" size={22} color={colors.dk} />
            <Text style={styles.langCode}>{locale === 'ar' ? 'EN' : 'ع'}</Text>
          </Pressable>
          <NotificationBell />
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

      {/* DRAWER */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="none"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            dirContainer,
            {
              width: drawerWidth,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Drawer header — layout mirrors automatically via parent `direction: rtl` */}
          <View style={styles.drawerHeader}>
            <Logo size="sm" />
            <Pressable
              onPress={() => setDrawerOpen(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.close}
              style={styles.iconBtn}
            >
              <Ionicons name="close" size={22} color={colors.dk} />
            </Pressable>
          </View>

          {/* User card — layout mirrors automatically via parent `direction: rtl` */}
          <View style={styles.userCard}>
            <AvatarCircle name={displayName} size={56} />
            <View style={styles.userCardBody}>
              <Text style={[styles.userName, dirText]} numberOfLines={1}>
                {displayName}
              </Text>
              {!!phone && (
                <Text style={[styles.userPhone, dirText]} numberOfLines={1}>
                  {phone}
                </Text>
              )}
              {!!badge.text && (
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, dirText, { color: badge.fg }]}>{badge.text}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Upgrade CTA */}
          {isClient && (
            <Pressable style={styles.upgradeBtn} onPress={() => go('/dashboard/subscription')}>
              <Ionicons name="storefront" size={16} color={colors.dk} />
              <Text style={[styles.upgradeText, dirText]}>{t.upgClientToStoreTitle}</Text>
            </Pressable>
          )}
          {isStore && (
            <Pressable style={styles.upgradeBtn} onPress={() => go('/dashboard/subscription')}>
              <Ionicons name="diamond" size={16} color={colors.dk} />
              <Text style={[styles.upgradeText, dirText]}>{t.upgStoreToPlusTitle}</Text>
            </Pressable>
          )}

          {/* Nav */}
          <ScrollView
            style={styles.navScroll}
            contentContainerStyle={{ paddingVertical: spacing.xs }}
            showsVerticalScrollIndicator={false}
          >
            {nav.map((n) => {
              const active = isActive(n.href)
              const label = (t as any)[n.labelKey] ?? String(n.labelKey)
              const showBadge = n.badgeKey === 'unread' && unread > 0
              return (
                <Pressable
                  key={n.href}
                  onPress={() => go(n.href)}
                  style={({ pressed }) => [
                    styles.navRow,
                    active && styles.navRowActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.navIcon, active && styles.navIconActive]}>
                    <Ionicons
                      name={n.icon}
                      size={18}
                      color={active ? colors.dk : colors.g600}
                    />
                  </View>
                  <Text
                    style={[styles.navLabel, dirText, active && styles.navLabelActive]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  {showBadge && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}

            {/* Logout */}
            <Pressable
              onPress={async () => {
                setDrawerOpen(false)
                await logout()
              }}
              style={({ pressed }) => [
                styles.navRow,
                styles.logoutRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.navIcon}>
                <Ionicons name="log-out-outline" size={18} color={colors.red} />
              </View>
              <Text style={[styles.navLabel, dirText, { color: colors.red }]}>{t.logout}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Modal>
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
    backgroundColor: colors.g100,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.g200,
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
    backgroundColor: colors.g300,
  },
  brandTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
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
  },
  bodyPadding: {
    padding: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    backgroundColor: colors.white,
    borderTopEndRadius: radius.xl,
    borderBottomEndRadius: radius.xl,
    paddingHorizontal: spacing.md,
    ...shadow.sl,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.g100,
    borderRadius: radius.lg,
  },
  userCardBody: {
    flexShrink: 1,
    gap: 2,
  },
  userName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  userPhone: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 4,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
  },
  upgradeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  navScroll: {
    marginTop: spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: 2,
  },
  navRowActive: {
    backgroundColor: colors.yl,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.g100,
  },
  navIconActive: {
    backgroundColor: colors.y,
  },
  navLabel: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
  },
  navLabelActive: {
    color: colors.dk,
    fontFamily: fonts.bold,
  },
  navBadge: {
    marginStart: 'auto',
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.white,
  },
  logoutRow: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.g200,
    paddingTop: spacing.md,
    borderRadius: 0,
  },
})
