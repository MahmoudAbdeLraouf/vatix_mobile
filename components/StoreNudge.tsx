// Convert-to-store cards for clients (port of the web `store-nudge.tsx`).
// - StoreAccountCard: the persistent "عندك محل؟" card on the dashboard tab.
// - StoreNudgeCard: the smart floating card, mounted once at the root layout, shown on
//   any screen when the client acts like a store (many listings / many Bro offers).
// Both show the same split: what the client has now (muted, dashed) vs what a store
// gets (yellow) — ∞ products · ∞ Bro offers · page in your name · gift promotion.
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { tabBarHeight } from '@/components/AnimatedTabBar'
import { goConvertToStore } from '@/components/ConvertToStorePick'
import { StoreApplicationStatusCard } from '@/components/StoreApplicationStatusCard'
import { useMyStoreApplication, useMyStoreApplicationAtRoot } from '@/hooks/useMyStoreApplication'
import { useStoreNudge } from '@/hooks/useStoreNudge'
import { fmt, svText, useStoreValueParams, type StoreValueParams } from '@/lib/storeValue'
import type { StoreNudgeTrigger } from '@/lib/storeApplication'

const DISMISS_MS = 7 * 24 * 60 * 60 * 1000
const SOFT_KEY = 'store_nudge_dismissed_until'
const CAP_KEY = 'store_nudge_cap_dismissed_until'

type Meter = { used: number; cap: number }

const isCap = (t: StoreNudgeTrigger | null | undefined) => t === 'product_cap' || t === 'offer_cap'

// ── Dismiss store ────────────────────────────────────────────────────────────
// Soft nudges and cap nudges dismiss separately, so hitting the cap after dismissing
// the soft card still shows the cap one. Cached in memory so every mount agrees.

const dismissedUntil = new Map<string, number>()
const dismissListeners = new Set<() => void>()

function useDismissed(key: string) {
  const [, rerender] = useState(0)
  const known = dismissedUntil.has(key)

  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    dismissListeners.add(l)
    return () => {
      dismissListeners.delete(l)
    }
  }, [])

  useEffect(() => {
    if (dismissedUntil.has(key)) return
    let alive = true
    SecureStore.getItemAsync(key)
      .then((v) => Number(v) || 0, () => 0)
      .then((until) => {
        if (!alive) return
        dismissedUntil.set(key, until)
        dismissListeners.forEach((l) => l())
      })
    return () => {
      alive = false
    }
  }, [key])

  // Hidden until the stored value is read, so a dismissed card never flashes.
  const dismissed = !known || (dismissedUntil.get(key) ?? 0) > Date.now()
  const dismiss = () => {
    const until = Date.now() + DISMISS_MS
    dismissedUntil.set(key, until)
    dismissListeners.forEach((l) => l())
    SecureStore.setItemAsync(key, String(until)).catch(() => {})
  }
  return { dismissed, dismiss }
}

// ── Inline registry ──────────────────────────────────────────────────────────
// While the account card is on screen, the floating card stays out of the way.

let inlineCount = 0
const inlineListeners = new Set<() => void>()

function setInline(d: number) {
  inlineCount = Math.max(0, inlineCount + d)
  inlineListeners.forEach((l) => l())
}

function useInlineCardShown() {
  const [shown, setShown] = useState(inlineCount > 0)
  useEffect(() => {
    const l = () => setShown(inlineCount > 0)
    inlineListeners.add(l)
    l()
    return () => {
      inlineListeners.delete(l)
    }
  }, [])
  return shown
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const } : null,
    colDir: ar ? { direction: 'rtl' as const } : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
  }
}

function useStyles() {
  const { colors, isDark } = useTheme()
  return useMemo(() => makeStyles(colors, isDark), [colors, isDark])
}

function useCopy() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const n = (x: number) => fmt(x, locale)
  return {
    ar,
    n,
    products: (x: number) => (ar ? `${n(x)} ${x >= 3 && x <= 10 ? 'منتجات' : 'منتج'}` : `${x} product${x === 1 ? '' : 's'}`),
    offers: (x: number) => (ar ? `${n(x)} ${x >= 3 && x <= 10 ? 'عروض' : 'عرض'}` : `${x} offer${x === 1 ? '' : 's'}`),
  }
}

/** Sub line with the counts in bold yellow; `parts` alternates plain / bold. */
function Sub({ parts }: { parts: string[] }) {
  const styles = useStyles()
  const { dirStyle } = useDir()
  return (
    <Text style={[styles.sub, dirStyle]}>
      {parts.map((s, i) =>
        i % 2 ? (
          <Text key={i} style={styles.subBold}>
            {s}
          </Text>
        ) : (
          s
        ),
      )}
    </Text>
  )
}

function triggerCopy(
  trigger: StoreNudgeTrigger,
  products: Meter,
  offers: Meter | null,
  p: StoreValueParams,
  c: ReturnType<typeof useCopy>,
) {
  const ar = c.ar
  const o = offers ?? { used: 0, cap: p.offers }
  const left = (m: Meter) => c.n(Math.max(0, m.cap - m.used))
  switch (trigger) {
    case 'offer_cap':
      return {
        icon: '⚡',
        cta: ar ? 'كمّل كمتجر' : 'Continue as a store',
        title: ar ? 'كمّل كمتجر — ابعت عروض من غير حد' : 'Continue as a store — send unlimited offers',
        sub: ar ? ['بعت ', c.offers(o.used), ' الشهر ده'] : ['You sent ', c.offers(o.used), ' this month'],
      }
    case 'product_cap':
      return {
        icon: '🏪',
        cta: ar ? 'كمّل كمتجر' : 'Continue as a store',
        title: ar ? 'كمّل كمتجر — منتجاتك من غير حد' : 'Continue as a store — no product limit',
        sub: ar
          ? ['نزّلت ', c.products(products.used), '، وده آخر حد للعميل']
          : ['You listed ', c.products(products.used), ', the client limit'],
      }
    case 'offers':
      return {
        icon: '⚡',
        cta: ar ? 'حوّل لمتجر' : 'Switch to a store',
        title: ar ? 'بتقدّم عروض كتير؟ المتجر عروضه مفتوحة' : 'Sending lots of offers? Stores have no limit',
        sub: ar
          ? ['بعت ', c.offers(o.used), ' الشهر ده — فاضلّك ', left(o), '']
          : ['You sent ', c.offers(o.used), ' this month — only ', left(o), ' left'],
      }
    case 'products':
      return {
        icon: '🏪',
        cta: ar ? 'حوّل لمتجر' : 'Switch to a store',
        title: ar ? 'بتبيع كتير؟ خلّيها متجر' : 'Selling a lot? Make it a store',
        sub: ar
          ? ['نزّلت ', c.products(products.used), ' — فاضلّك ', left(products), ' بس كعميل']
          : ['You listed ', c.products(products.used), ' — only ', left(products), ' left as a client'],
      }
  }
}

// ── Split: now (client) vs as a store ────────────────────────────────────────

function Row({ label, meter, n }: { label: string; meter: Meter; n: (x: number) => string }) {
  const styles = useStyles()
  const { rowDir, dirStyle } = useDir()
  const ratio = meter.cap > 0 ? meter.used / meter.cap : 1
  const full = ratio >= 1
  const hot = !full && ratio >= 0.6
  return (
    <View style={[styles.row, rowDir]}>
      <Text style={[styles.rowLabel, dirStyle, hot && styles.hotText, full && styles.fullText]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowVal, hot && styles.hotVal, full && styles.fullVal]}>
        {n(meter.used)}/{n(meter.cap)}
      </Text>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            hot && styles.barHot,
            full && styles.barFull,
            { width: `${Math.min(100, Math.round(ratio * 100))}%` },
          ]}
        />
      </View>
    </View>
  )
}

function OffRow({ label }: { label: string }) {
  const styles = useStyles()
  const { rowDir, dirStyle } = useDir()
  return (
    <View style={[styles.row, rowDir]}>
      <Text style={[styles.rowLabel, dirStyle]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowVal, styles.offVal]}>✕</Text>
    </View>
  )
}

function StoreRow({ label, value }: { label: string; value?: string }) {
  const styles = useStyles()
  const { rowDir, dirStyle } = useDir()
  return (
    <View style={[styles.row, rowDir]}>
      <Text style={[styles.rowLabel, styles.storeLabel, dirStyle]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.storeVal}>{value}</Text>
      ) : (
        <View style={styles.tick}>
          <Text style={styles.tickText}>✓</Text>
        </View>
      )}
    </View>
  )
}

function NudgeSplit({ products, offers, full }: { products: Meter; offers: Meter | null; full: boolean }) {
  const styles = useStyles()
  const { t, locale } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const p = useStoreValueParams()
  const n = (x: number) => fmt(x, locale)
  const sv = t.storeValue
  const gift = p.giftDays > 0

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.split, rowDir]}>
        <View style={[styles.pane, styles.nowPane, full && styles.nowPaneFull, colDir]}>
          <Text style={[styles.paneLabel, styles.nowPaneLabel, dirStyle]} numberOfLines={1}>
            👤 {ar ? 'إنت دلوقتي · عميل' : 'You now · client'}
          </Text>
          <Row label={ar ? 'منتجات' : 'Products'} meter={products} n={n} />
          {offers ? <Row label={ar ? 'عروض Bro' : 'Bro offers'} meter={offers} n={n} /> : null}
          <OffRow label={ar ? 'صفحة باسم محلك' : 'Page in your name'} />
          {gift ? <OffRow label={ar ? 'ترويج منتج هدية' : 'Free product promo'} /> : null}
        </View>

        <View style={styles.arrow}>
          <Text style={styles.arrowText}>{ar ? '←' : '→'}</Text>
        </View>

        <View style={[styles.pane, styles.storePane, colDir]}>
          <View style={[styles.storeHead, rowDir]}>
            <Text style={[styles.paneLabel, styles.storePaneLabel, dirStyle]} numberOfLines={1}>
              🏪 {ar ? 'لما تبقى متجر' : 'As a store'}
            </Text>
            <View style={styles.em}>
              <Text style={styles.emText}>{ar ? 'بعد الموافقة' : 'once approved'}</Text>
            </View>
          </View>
          <StoreRow label={ar ? 'منتجات' : 'Products'} value="∞" />
          {offers ? <StoreRow label={ar ? 'عروض Bro' : 'Bro offers'} value="∞" /> : null}
          <StoreRow label={ar ? '🔗 صفحة باسم محلك' : '🔗 Page in your name'} />
          {gift ? <StoreRow label={ar ? '🎁 ترويج منتج هدية' : '🎁 Free product promo'} /> : null}
        </View>
      </View>

      {p.trialDays > 0 ? (
        <View style={[styles.trial, rowDir]}>
          <View style={styles.trialDot} />
          <Text style={[styles.trialText, dirStyle]}>
            {svText(sv, 'trialFirst', p, locale)}
            {ar ? ' تبدأ من يوم الموافقة' : ' from the day you’re approved'}
          </Text>
        </View>
      ) : null}

      {gift ? (
        <View style={[styles.giftNote, colDir]}>
          <Text style={[styles.giftText, dirStyle]}>
            🎁 <Text style={styles.giftBold}>{sv.giftTitle}</Text> — {svText(sv, 'giftSub', p, locale)}
          </Text>
          <Text style={[styles.giftSmall, dirStyle]}>
            {ar ? 'الهدية مع الدفع — مش مع التجربة المجانية' : 'The gift comes with payment — not with the free trial'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// ── Floating smart card ──────────────────────────────────────────────────────

const TAB_PATHS = new Set(['/home', '/products', '/stores', '/dashboard', '/requests', '/bro-finds'])
const HIDDEN_PREFIXES = [
  '/login',
  '/register',
  '/otp',
  '/signup',
  '/forgot',
  '/sign-in-required',
  '/welcome',
  '/checkout',
  '/payment',
  '/pricing',
  '/dashboard/store-application',
  '/dashboard/subscription',
  '/dashboard/promote-store',
  '/dashboard/buy-offers',
  '/dashboard/buy-slots',
  '/dashboard/messages/',
  '/store/',
  '/products/',
  '/bro/new',
  '/bro/i/',
  '/contact',
  '/add',
]

function hiddenOn(path: string) {
  return path === '/' || HIDDEN_PREFIXES.some((h) => path.startsWith(h))
}

export function StoreNudgeCard() {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const { rowDir, colDir, dirStyle, ar } = useDir()
  const c = useCopy()
  const p = useStoreValueParams()
  const { nudge, isClient, loaded } = useStoreNudge()
  const { open, loaded: appLoaded } = useMyStoreApplicationAtRoot()
  const inline = useInlineCardShown()
  const cap = isCap(nudge?.trigger)
  const { dismissed, dismiss } = useDismissed(cap ? CAP_KEY : SOFT_KEY)

  if (!isClient || !loaded || !appLoaded || open || !nudge?.trigger) return null
  if (dismissed || inline || hiddenOn(pathname)) return null

  const copy = triggerCopy(nudge.trigger, nudge.products, nudge.offers, p, c)
  const bottom = TAB_PATHS.has(pathname) ? tabBarHeight(insets.bottom) + 8 : insets.bottom + 12

  return (
    <View pointerEvents="box-none" style={[styles.floatWrap, { bottom }]}>
      <View style={[styles.card, styles.compact, colDir]}>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={ar ? 'إغلاق' : 'Dismiss'}
        >
          <Ionicons name="close" size={15} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <View style={[styles.head, rowDir]}>
          <View style={[styles.icon, styles.iconCompact]}>
            <Text style={styles.iconTextCompact}>{copy.icon}</Text>
          </View>
          <View style={[{ flex: 1 }, colDir]}>
            <Text style={[styles.title, styles.titleCompact, dirStyle]}>{copy.title}</Text>
            <Sub parts={copy.sub} />
          </View>
        </View>

        <NudgeSplit products={nudge.products} offers={nudge.offers} full={cap} />

        <View style={[styles.actions, rowDir]}>
          <Pressable onPress={goConvertToStore} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>{copy.cta}</Text>
          </Pressable>
          <Pressable onPress={dismiss} style={styles.later} accessibilityRole="button">
            <Text style={styles.laterText}>{ar ? 'بعدين' : 'Later'}</Text>
          </Pressable>
        </View>

        {nudge.trigger === 'offer_cap' ? (
          <Text style={[styles.alt, { writingDirection: dirStyle.writingDirection }]}>
            {ar ? 'أو ' : 'or '}
            <Text style={styles.altLink} onPress={() => router.push('/dashboard/buy-offers' as never)}>
              {ar ? 'اشتري باقة عروض' : 'buy an offers pack'}
            </Text>
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ── Persistent account card (dashboard tab) ──────────────────────────────────

export function StoreAccountCard({
  onConvert = goConvertToStore,
  disabled,
  style,
}: {
  onConvert?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const styles = useStyles()
  const { rowDir, colDir, dirStyle, ar } = useDir()
  const p = useStoreValueParams()
  const { nudge, isClient, loaded } = useStoreNudge()
  const { app, open, loaded: appLoaded } = useMyStoreApplication()

  useEffect(() => {
    if (!isClient) return
    setInline(1)
    return () => setInline(-1)
  }, [isClient])

  if (!isClient || !appLoaded) return null
  if (open && app) return <StoreApplicationStatusCard app={app} style={style} />
  if (!loaded) return null

  const products = nudge?.products ?? { used: 0, cap: p.cap }
  const offers = nudge ? nudge.offers : p.offersOn ? { used: 0, cap: p.offers } : null
  const full = !!nudge?.trigger && isCap(nudge.trigger)

  return (
    <View style={[styles.card, colDir, style]}>
      <View style={[styles.head, styles.headNoClose, rowDir]}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>🏪</Text>
        </View>
        <View style={[{ flex: 1 }, colDir]}>
          <Text style={[styles.title, dirStyle]}>
            {ar ? 'عندك محل؟ حوّل حسابك لمتجر' : 'Have a shop? Switch your account to a store'}
          </Text>
          <Text style={[styles.sub, dirStyle]}>
            {ar
              ? 'نفس الحساب ونفس الرقم — منتجاتك وعروضك بتفضل زي ما هي'
              : 'Same account, same number — your products and offers stay as they are'}
          </Text>
        </View>
      </View>

      <NudgeSplit products={products} offers={offers} full={full} />

      <Pressable
        onPress={disabled ? undefined : onConvert}
        disabled={disabled}
        style={[styles.cta, disabled && { opacity: 0.5 }]}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{ar ? 'حوّل لمتجر ‹' : 'Switch to a store ›'}</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    floatWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
    card: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: c.hero,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 12,
      gap: 10,
      borderWidth: isDark ? 1 : 0,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    compact: {
      padding: 12,
      gap: 9,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    close: {
      position: 'absolute',
      top: 10,
      end: 10,
      zIndex: 2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingEnd: 28 },
    headNoClose: { paddingEnd: 0 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      backgroundColor: c.y,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCompact: { width: 38, height: 38, borderRadius: 11 },
    iconText: { fontSize: 22 },
    iconTextCompact: { fontSize: 19 },
    title: { fontFamily: fonts.black, fontSize: 15.5, color: c.white },
    titleCompact: { fontSize: 14 },
    sub: { fontFamily: fonts.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 1 },
    subBold: { fontFamily: fonts.black, color: c.y },

    split: { flexDirection: 'row', alignItems: 'stretch' },
    pane: { flex: 1, borderRadius: 12, paddingTop: 7, paddingHorizontal: 9, paddingBottom: 6 },
    nowPane: {
      backgroundColor: 'rgba(255,255,255,0.035)',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.24)',
    },
    nowPaneFull: { borderColor: 'rgba(249,115,22,0.6)', backgroundColor: 'rgba(249,115,22,0.06)' },
    storePane: { backgroundColor: c.y },
    storeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
    paneLabel: { fontFamily: fonts.black, fontSize: 10, lineHeight: 17, height: 17, marginBottom: 3 },
    nowPaneLabel: { color: 'rgba(255,255,255,0.5)' },
    storePaneLabel: { color: '#5c4300', flexShrink: 1 },
    em: { backgroundColor: c.dk, borderRadius: 99, paddingVertical: 1, paddingHorizontal: 6, marginBottom: 3 },
    emText: { fontFamily: fonts.bold, fontSize: 9, color: c.y },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 22,
      paddingBottom: 5,
      gap: 4,
    },
    rowLabel: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.62)' },
    rowVal: { fontFamily: fonts.black, fontSize: 11, color: 'rgba(255,255,255,0.62)' },
    offVal: { opacity: 0.3 },
    hotText: { color: c.white },
    hotVal: { color: c.y },
    fullText: { color: '#FDBA74' },
    fullVal: { color: '#FB923C' },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      flexDirection: 'row',
    },
    barFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
    barHot: { backgroundColor: c.y },
    barFull: { backgroundColor: '#FB923C' },
    storeLabel: { color: c.dk },
    storeVal: { fontFamily: fonts.black, fontSize: 14.5, lineHeight: 17, color: c.dk },
    tick: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.dk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tickText: { fontFamily: fonts.black, fontSize: 9.5, lineHeight: 13, color: c.y },

    arrow: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.dk,
      borderWidth: 1.5,
      borderColor: c.y,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: -6,
      zIndex: 1,
      alignSelf: 'center',
    },
    arrowText: { fontFamily: fonts.black, fontSize: 11, lineHeight: 14, color: c.y },

    trial: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    trialDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12B886' },
    trialText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 11.5, color: '#8ff0c8' },
    giftNote: { marginTop: -4, gap: 1 },
    giftText: { fontFamily: fonts.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.78)' },
    giftBold: { fontFamily: fonts.black, color: c.y },
    giftSmall: { fontFamily: fonts.semiBold, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' },

    actions: { flexDirection: 'row', gap: 8 },
    cta: {
      flex: 1,
      borderRadius: 11,
      backgroundColor: c.y,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontFamily: fonts.black, fontSize: 14, color: c.dk },
    later: {
      borderRadius: 11,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    laterText: { fontFamily: fonts.bold, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    alt: { fontFamily: fonts.semiBold, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
    altLink: { fontFamily: fonts.bold, color: c.y, textDecorationLine: 'underline' },
  })
}
