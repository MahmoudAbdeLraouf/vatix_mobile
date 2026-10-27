import { Tabs, router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { AnimatedTabBar, type TabIcons } from '@/components/AnimatedTabBar'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const TAB_ICONS: TabIcons = {
  home: { active: 'home', inactive: 'home-outline' },
  products: { active: 'grid', inactive: 'grid-outline' },
  requests: { active: 'megaphone', inactive: 'megaphone-outline' },
  stores: { active: 'storefront', inactive: 'storefront-outline' },
  dashboard: { active: 'menu', inactive: 'menu-outline' },
}

export default function TabsLayout() {
  const { t, locale, isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const { requireLogin } = useLoginGate()
  const broEnabled = useBroEnabled()
  const [chooserOpen, setChooserOpen] = useState(false)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  // The + button: with Bro on it asks whether to post a product or a request; otherwise straight to the product flow.
  function onFabPress() {
    if (!requireLogin()) return
    if (broEnabled) setChooserOpen(true)
    else router.push('/products/new')
  }

  function choose(path: 'product' | 'request') {
    setChooserOpen(false)
    if (path === 'product') router.push('/products/new')
    else router.push({ pathname: '/bro/new', params: { source: 'nav' } } as never)
  }

  // Bar order; the + sits in the middle. Bro swaps the stores tab for the buyer requests board.
  const visibleTabs = broEnabled
    ? ['home', 'products', 'add', 'requests', 'dashboard']
    : ['home', 'products', 'add', 'stores', 'dashboard']

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
      <Tabs.Screen name="home" options={{ title: t.home }} />
      <Tabs.Screen name="products" options={{ title: t.products }} />
      {/* Buyer requests board — replaces the stores and Geeko tabs while Bro is on. */}
      <Tabs.Screen name="requests" options={{ title: t.bro.requestsNav, href: broEnabled ? undefined : null }} />
      {/* Rendered by AnimatedTabBar as the + button; never navigated to. */}
      <Tabs.Screen name="add" options={{ title: '' }} />
      <Tabs.Screen name="stores" options={{ title: t.stores, href: broEnabled ? null : undefined }} />
      {/* Hidden from the bar; still reachable from notifications and the requests flow. */}
      <Tabs.Screen name="bro-finds" options={{ title: t.bro.tabLabel, href: null }} />
      {/* Open to guests too — the screen shows its own sign-in card. */}
      <Tabs.Screen name="dashboard" options={{ title: t.moreTab }} />
    </Tabs>
    <Modal visible={chooserOpen} transparent animationType="fade" onRequestClose={() => setChooserOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setChooserOpen(false)}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={[styles.sheetTitle, { writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{t.bro.fabChooserTitle}</Text>
          <ChooserRow
            icon={<View style={styles.rowIconY}><Ionicons name="camera" size={24} color={colors.dk} /></View>}
            title={t.bro.fabPostProduct}
            sub={t.bro.fabPostProductSub}
            isRtl={isRtl}
            onPress={() => choose('product')}
          />
          <ChooserRow
            icon={<View style={styles.rowIconDk}><BroAvatar size={36} /></View>}
            title={t.bro.fabPostRequest}
            sub={t.bro.fabPostRequestSub}
            isRtl={isRtl}
            onPress={() => choose('request')}
          />
        </Pressable>
      </Pressable>
    </Modal>
    </>
  )
}

function ChooserRow({ icon, title, sub, isRtl, onPress }: {
  icon: React.ReactNode
  title: string
  sub: string
  isRtl: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const dir = { writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, dir]}>{title}</Text>
        <Text style={[styles.rowSub, dir]}>{sub}</Text>
      </View>
      <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.subtle} />
    </Pressable>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.dot, marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.heading, marginBottom: spacing.xs, textAlign: 'auto' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  rowIconY: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.y, alignItems: 'center', justifyContent: 'center' },
  rowIconDk: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.fab, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.heading },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
})
