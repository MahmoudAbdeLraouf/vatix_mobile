import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { AnimatedTabBar, TAB_ICONS } from '@/components/AnimatedTabBar'
import { usePostFab, useTabBarRoutes, useTabTitles } from '@/components/PostFab'
import { useTheme } from '@/contexts/theme'

export default function TabsLayout() {
  const { t, locale, isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const broEnabled = useBroEnabled()
  const visibleTabs = useTabBarRoutes()
  const titles = useTabTitles()
  const { onFabPress, chooser } = usePostFab()
  const { colors } = useTheme()

  return (
    <>
    <Tabs
      key={locale}
      tabBar={props => (
        <AnimatedTabBar
          {...props}
          visible={visibleTabs}
          icons={TAB_ICONS}
          isRtl={isRtl}
          bottomInset={insets.bottom}
          onFabPress={onFabPress}
          fabLabel={t.postFreeAd}
        />
      )}
      screenOptions={{
        headerShown: false,
        // Bottom-tabs scene wrapper — direction must be set here for Yoga to
        // mirror inside each tab's native container.
        sceneStyle: { direction: isRtl ? 'rtl' : 'ltr', backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: titles.home }} />
      <Tabs.Screen name="products" options={{ title: titles.products }} />
      {/* Buyer requests board — replaces the stores and Geeko tabs while Bro is on. */}
      <Tabs.Screen name="requests" options={{ title: titles.requests, href: broEnabled ? undefined : null }} />
      {/* Rendered by AnimatedTabBar as the + button; never navigated to. */}
      <Tabs.Screen name="add" options={{ title: titles.add }} />
      <Tabs.Screen name="stores" options={{ title: titles.stores, href: broEnabled ? null : undefined }} />
      {/* Hidden from the bar; still reachable from notifications and the requests flow. */}
      <Tabs.Screen name="bro-finds" options={{ title: t.bro.tabLabel, href: null }} />
      {/* Open to guests too — the screen shows its own sign-in card. */}
      <Tabs.Screen name="dashboard" options={{ title: titles.dashboard }} />
    </Tabs>
    {chooser}
    </>
  )
}
