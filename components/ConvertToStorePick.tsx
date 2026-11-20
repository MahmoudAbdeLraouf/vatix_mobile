// The 4th pick next to the promotion bundles: "switch to a store and get a free
// ad promotion" (mockups/convert-to-store-pick.html). The gift is the backend's
// per-payment subscription gift, so nothing here grants anything; pressing opens
// the normal upgrade flow. Shown only to clients who already used their free trial.
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { authFetch } from '@/lib/auth'
import type { UserProfile } from '@/lib/api'
import { PAID_UI_ENABLED } from '@/lib/platform'
import { formatGiftDays } from '@/lib/promoGift'
import { fmtPrice, toArDigits, useStoreValueParams } from '@/lib/storeValue'

let cache: { key: string; promise: Promise<boolean> } | null = null

function loadEligible(key: string): Promise<boolean> {
  if (cache?.key !== key) {
    cache = {
      key,
      promise: authFetch<UserProfile>('/user/profile').then(
        (p) => p?.type === 'client' && p.trialUsed === true,
        () => false,
      ),
    }
  }
  return cache.promise
}

/** True only for a logged-in client whose free trial is used up. */
export function useConvertPickEligible(): boolean {
  const { user } = useAuth()
  const [eligible, setEligible] = useState(false)
  const key = user && !user.isStore ? String(user.id) : null
  useEffect(() => {
    setEligible(false)
    if (!key) return
    let alive = true
    loadEligible(key).then((v) => {
      if (alive) setEligible(v)
    })
    return () => {
      alive = false
    }
  }, [key])
  return eligible
}

export function goConvertToStore() {
  router.push({ pathname: '/dashboard/subscription', params: { upgrade: 'store' } } as never)
}

export function ConvertToStorePick({
  variant = 'card',
  onPress = goConvertToStore,
  ribbon,
  dark = false,
}: {
  /** `card` sits with the bundle cards; `row` sits in a compact bundle list (my-ads sheet). */
  variant?: 'card' | 'row'
  onPress?: () => void
  ribbon?: string
  /** Navy CTA, for lists that already have a yellow "best value" button. */
  dark?: boolean
}) {
  const { colors, isDark } = useTheme()
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const p = useStoreValueParams()
  if (p.loading || p.giftDays <= 0) return null

  const tx = (a: string, e: string) => (ar ? a : e)
  const n = (v: number) => (ar ? toArDigits(fmtPrice(v)) : fmtPrice(v))
  const gd = ar ? toArDigits(formatGiftDays(p.giftDays, 'ar')) : formatGiftDays(p.giftDays, 'en')
  const dir = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: ar ? ('right' as const) : ('left' as const) }
  const row = { flexDirection: ar ? ('row-reverse' as const) : ('row' as const) }
  const perMonth = tx('ج.م/شهر', 'EGP/mo')

  if (variant === 'row') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <View style={[s.rowL1, row]}>
          <Text style={[s.rowTitle, dir]}>🏪 {tx('حوّل لمتجر', 'Switch to a store')}</Text>
          {PAID_UI_ENABLED && (
            <Text style={s.rowTitle}>
              {n(p.price)} {perMonth}
            </Text>
          )}
        </View>
        <Text style={[s.rowGift, dir]}>
          🎁 {tx(`+ ترويج ${gd} هدية مع كل تجديد`, `+ free ${gd} promotion with every renewal`)}
        </Text>
      </Pressable>
    )
  }

  const features = [
    tx('منتجات بلا حدود', 'Unlimited products'),
    ...(p.offersOn ? [tx('عروض بلا حدود', 'Unlimited offers')] : []),
    tx('صفحة متجر خاصة بيك', 'Your own store page'),
    tx('علامة التوثيق + إحصائيات', 'Verified badge + analytics'),
  ]

  return (
    <View style={s.card}>
      <View style={[s.ribbon, ar ? { left: 12 } : { right: 12 }]}>
        <Text style={s.ribbonText}>⭐ {ribbon ?? tx('الأوفر لو بتبيع كتير', 'Best if you sell a lot')}</Text>
      </View>
      <Text style={[s.title, dir]}>🏪 {tx('حوّل لمتجر', 'Switch to a store')}</Text>
      <View style={[s.gift, row]}>
        <Text style={{ fontSize: 18 }}>🎁</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.giftTitle, dir]}>
            {tx(`ترويج إعلان ${gd} هدية مع كل تجديد`, `Free ${gd} ad promotion with every renewal`)}
          </Text>
          <Text style={[s.giftSub, dir]}>
            {PAID_UI_ENABLED
              ? tx(`قيمته ${n(p.giftValue)} ج.م · بتختار الإعلان بعد الدفع`, `Worth ${p.giftValue} EGP · pick the ad after paying`)
              : tx('بتختار الإعلان بعد الاشتراك', 'Pick the ad after subscribing')}
          </Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        {features.map((f) => (
          <View key={f} style={[row, { gap: 6 }]}>
            <Text style={s.check}>✓</Text>
            <Text style={[s.feature, dir]}>{f}</Text>
          </View>
        ))}
      </View>
      {PAID_UI_ENABLED && (
        <Text style={[s.price, dir]}>
          <Text style={s.priceBig}>{n(p.price)}</Text> {tx('ج.م / شهر', 'EGP / month')}
          {p.list > p.price ? (
            <>
              {'  '}
              <Text style={s.strike}>{n(p.list)}</Text>
            </>
          ) : null}
        </Text>
      )}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.cta, { backgroundColor: dark ? colors.dk : colors.y }, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={[s.ctaText, { color: dark ? colors.white : colors.dk }]}>
          {tx('حوّل لمتجر وخد الترويج ←', 'Switch & get the promotion →')}
        </Text>
      </Pressable>
    </View>
  )
}

/** "أو" divider between the bundle list and the row variant. */
export function ConvertOrDivider() {
  const { colors } = useTheme()
  const { locale } = useLocale()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontFamily: fonts.extraBold, fontSize: 11, color: colors.muted }}>
        {locale === 'ar' ? 'أو' : 'or'}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  )
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  const giftText = isDark ? c.y : c.yellowText
  return StyleSheet.create({
    card: {
      borderWidth: 2,
      borderColor: c.y,
      borderRadius: radius.lg,
      backgroundColor: isDark ? c.card : c.yellowBg,
      paddingTop: 22,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
      shadowColor: c.y,
      shadowOpacity: isDark ? 0 : 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: isDark ? 0 : 3,
    },
    ribbon: {
      position: 'absolute',
      top: -11,
      backgroundColor: c.dk,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    ribbonText: { fontFamily: fonts.extraBold, fontSize: 10.5, color: c.y },
    title: { fontFamily: fonts.black, fontSize: 16, color: c.heading },
    gift: {
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: 'rgba(245,184,0,0.7)',
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: 10,
    },
    giftTitle: { fontFamily: fonts.black, fontSize: 13.5, lineHeight: 20, color: giftText },
    giftSub: { fontFamily: fonts.bold, fontSize: 11.5, color: c.muted, marginTop: 2 },
    check: { fontFamily: fonts.black, fontSize: 12.5, color: c.green },
    feature: { fontFamily: fonts.bold, fontSize: 12.5, color: c.text },
    price: { fontFamily: fonts.extraBold, fontSize: 13, color: c.text },
    priceBig: { fontSize: 20, color: c.heading },
    strike: { fontSize: 13, color: c.subtle, textDecorationLine: 'line-through' },
    cta: {
      marginTop: 4,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontFamily: fonts.extraBold, fontSize: 14 },
    row: {
      borderWidth: 2,
      borderColor: c.y,
      borderRadius: 10,
      backgroundColor: isDark ? c.card : c.yellowBg,
      paddingVertical: spacing.sm,
      paddingHorizontal: 10,
    },
    rowL1: { justifyContent: 'space-between', gap: spacing.sm },
    rowTitle: { fontFamily: fonts.black, fontSize: 12, color: c.heading },
    rowGift: { fontFamily: fonts.extraBold, fontSize: 10.5, color: giftText, marginTop: 2 },
  })
}
