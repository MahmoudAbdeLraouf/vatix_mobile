import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { colors, fonts } from '@/constants/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

interface TabDef {
  key: string
  href: string
  labelKey: 'home' | 'products' | 'stores' | 'dashboard'
  active: IoniconsName
  inactive: IoniconsName
  matches: (pathname: string) => boolean
}

const TABS: TabDef[] = [
  {
    key: 'home',
    href: '/(tabs)/home',
    labelKey: 'home',
    active: 'home',
    inactive: 'home-outline',
    matches: p => p === '/' || p === '/home' || p === '/(tabs)/home',
  },
  {
    key: 'products',
    href: '/(tabs)/products',
    labelKey: 'products',
    active: 'grid',
    inactive: 'grid-outline',
    matches: p => (p === '/products' || p === '/(tabs)/products') && p !== '/products/add',
  },
  {
    key: 'stores',
    href: '/(tabs)/stores',
    labelKey: 'stores',
    active: 'storefront',
    inactive: 'storefront-outline',
    matches: p => p === '/stores' || p === '/(tabs)/stores',
  },
  {
    key: 'dashboard',
    href: '/(tabs)/dashboard',
    labelKey: 'dashboard',
    active: 'person',
    inactive: 'person-outline',
    matches: p => p === '/dashboard' || p === '/(tabs)/dashboard',
  },
]

const FAB_SIZE = 56
const FAB_LIFT = 18

export function BottomTabBar() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const pathname = usePathname() ?? ''

  const onAddPress = () => {
    if (pathname !== '/products/add') router.push('/products/add')
  }

  const go = (href: string) => {
    router.push(href as never)
  }

  const [homeTab, productsTab, storesTab, dashboardTab] = TABS

  return (
    <View
      style={[
        styles.bar,
        { height: 62 + insets.bottom, paddingBottom: insets.bottom + 6 },
      ]}
    >
      <TabButton tab={homeTab} label={t.home} pathname={pathname} onPress={go} />
      <TabButton tab={productsTab} label={t.products} pathname={pathname} onPress={go} />

      <View style={styles.fabSlot} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.postFreeAd}
          onPress={onAddPress}
          style={({ pressed }) => [
            styles.fab,
            { transform: [{ translateY: -FAB_LIFT }, { scale: pressed ? 0.96 : 1 }] },
          ]}
        >
          <View style={styles.iconStack}>
            <Ionicons name="camera" size={30} color={colors.white} />
            <Ionicons name="add" size={14} color={colors.y} style={styles.iconPlus} />
          </View>
        </Pressable>
      </View>

      <TabButton tab={storesTab} label={t.stores} pathname={pathname} onPress={go} />
      <TabButton tab={dashboardTab} label={t.dashboard} pathname={pathname} onPress={go} />
    </View>
  )
}

function TabButton({
  tab,
  label,
  pathname,
  onPress,
}: {
  tab: TabDef
  label: string
  pathname: string
  onPress: (href: string) => void
}) {
  const focused = tab.matches(pathname)
  const color = focused ? colors.y : colors.g500
  return (
    <Pressable
      onPress={() => onPress(tab.href)}
      style={styles.tabBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={focused ? tab.active : tab.inactive} size={24} color={color} />
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderTopColor: colors.g200,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  iconStack: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlus: {
    position: 'absolute',
    top: 10,
  },
})
