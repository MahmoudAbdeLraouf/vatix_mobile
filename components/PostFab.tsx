import { router, usePathname } from 'expo-router'
import { useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { useLoginGate } from '@/contexts/loginGate'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { BroAvatar } from '@/components/bro/BroAvatar'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

// Bar order; the + sits in the middle. Bro swaps the stores tab for the buyer requests board.
export function useTabBarRoutes() {
  const broEnabled = useBroEnabled()
  return broEnabled
    ? ['home', 'products', 'add', 'requests', 'dashboard']
    : ['home', 'products', 'add', 'stores', 'dashboard']
}

// Bar labels, keyed by tab route name.
export function useTabTitles(): Record<string, string> {
  const { t } = useLocale()
  return {
    home: t.home,
    products: t.products,
    requests: t.bro.requestsNav,
    add: '',
    stores: t.stores,
    dashboard: t.moreTab,
  }
}

// The + button: with Bro on it asks whether to post a product or a request; otherwise straight to the product flow.
// Render `chooser` once next to the bar.
export function usePostFab() {
  const { t, isRtl } = useLocale()
  const insets = useSafeAreaInsets()
  const pathname = usePathname() ?? ''
  const { requireLogin } = useLoginGate()
  const broEnabled = useBroEnabled()
  const [open, setOpen] = useState(false)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  function goPostProduct() {
    if (pathname !== '/products/new' && pathname !== '/products/add') router.push('/products/new')
  }

  function onFabPress() {
    if (!requireLogin()) return
    if (broEnabled) setOpen(true)
    else goPostProduct()
  }

  function choose(path: 'product' | 'request') {
    setOpen(false)
    if (path === 'product') goPostProduct()
    else router.push({ pathname: '/bro/new', params: { source: 'nav' } } as never)
  }

  const chooser = (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
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
  )

  return { onFabPress, chooser }
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
