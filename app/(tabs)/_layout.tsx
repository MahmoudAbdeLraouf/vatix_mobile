import { Tabs, router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { colors, fonts } from '@/constants/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  home: { active: 'home', inactive: 'home-outline' },
  products: { active: 'grid', inactive: 'grid-outline' },
  stores: { active: 'storefront', inactive: 'storefront-outline' },
  dashboard: { active: 'person', inactive: 'person-outline' },
}

const FAB_SIZE = 56
const FAB_LIFT = 18

export default function TabsLayout() {
  const { t, locale, isRtl } = useLocale()
  const insets = useSafeAreaInsets()

  const tabBarHeight = 62 + insets.bottom

  return (
    <Tabs
      key={locale}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Bottom-tabs scene wrapper — direction must be set here for Yoga to
        // mirror inside each tab's native container.
        sceneStyle: { direction: isRtl ? 'rtl' : 'ltr' },
        tabBarActiveTintColor: colors.y,
        tabBarInactiveTintColor: colors.g500,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.g200,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.semiBold,
          fontSize: 11,
        },
        tabBarIcon: ({ color, focused }) => {
          const icons = TAB_ICONS[route.name]
          if (!icons) return null
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={24}
              color={color}
            />
          )
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: t.home }} />
      <Tabs.Screen name="products" options={{ title: t.products }} />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarButton: () => (
            <View style={styles.fabSlot} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.postFreeAd}
                onPress={() => router.push('/products/add')}
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
          ),
        }}
        listeners={{
          tabPress: e => {
            e.preventDefault()
            router.push('/products/add')
          },
        }}
      />
      <Tabs.Screen name="stores" options={{ title: t.stores }} />
      <Tabs.Screen name="dashboard" options={{ title: t.dashboard }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
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
