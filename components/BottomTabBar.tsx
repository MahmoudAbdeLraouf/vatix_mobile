import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { AnimatedTabBar, TAB_ICONS, lastFocusedTab } from '@/components/AnimatedTabBar'
import { usePostFab, useTabBarRoutes, useTabTitles } from '@/components/PostFab'

// The tabs bar for screens outside the (tabs) navigator (store page, auth, add-product). Same AnimatedTabBar,
// fed a stand-in navigator state focused on the tab the user came from; every tab press (that one included) pushes its route.
export function BottomTabBar() {
  const { t, isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const visible = useTabBarRoutes()
  const titles = useTabTitles()
  const { onFabPress, chooser } = usePostFab()

  const routes = visible.map(name => ({ key: name, name, params: undefined }))
  const descriptors = Object.fromEntries(routes.map(r => [r.key, { options: { title: titles[r.name] } }]))
  // AnimatedTabBar ignores presses on the focused tab, so navigate from the press event and mark it handled.
  const navigation = {
    emit: ({ type, target }: { type: string; target: string }) => {
      if (type === 'tabPress') router.push(`/(tabs)/${target}` as never)
      return { defaultPrevented: true }
    },
  }
  const index = visible.indexOf(lastFocusedTab())
  const props = { state: { index, routes }, descriptors, navigation, insets } as unknown as BottomTabBarProps

  return (
    <>
      <AnimatedTabBar
        {...props}
        visible={visible}
        icons={TAB_ICONS}
        isRtl={isRtl}
        bottomInset={insets.bottom}
        onFabPress={onFabPress}
        fabLabel={t.postFreeAd}
      />
      {chooser}
    </>
  )
}
