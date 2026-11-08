// Passive client → store banner (mockups/store-upsell-system.html §5). Used on the
// dashboard tab and my-ads. Copy follows real usage: under 5 listings → "افتح
// متجرك"; 5+ → "بقيت بتبيع كتير" + meter; at the cap → the cap-reached copy.
// Dismissible for 30 days (SecureStore timestamp, same as the web banner).
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { fonts, radius, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { Button } from '@/components/ui/Button'
import { StoreValueChips } from '@/components/StoreValue'
import { PAID_UI_ENABLED } from '@/lib/platform'
import { fmtPrice, svText, useStoreValueParams, type StoreValueParams } from '@/lib/storeValue'

const DISMISS_MS = 30 * 24 * 60 * 60 * 1000
/** Listings used at which the copy switches from "open your store" to the meter. */
const METER_FROM = 5

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

interface Props {
  /** Listings counted against the cap. */
  used: number
  /** Effective cap (site cap + purchased slots). Defaults to the site cap. */
  cap?: number
  params?: StoreValueParams
  onConvert: () => void
  /** SecureStore key suffix for the 30-day dismiss; omit to hide the ✕. */
  dismissKey?: string
  disabled?: boolean
  style?: ViewStyle
}

export function StoreUpsellBanner({ used, cap: capProp, params, onConvert, dismissKey, disabled, style }: Props) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, colDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const live = useStoreValueParams()
  const p = params ?? live
  const sv = t.storeValue
  const cap = capProp || p.cap
  const storeKey = dismissKey ? `store_upsell_dismissed_${dismissKey}` : null
  // Hidden until the dismiss timestamp is read, so a dismissed banner never flashes.
  const [hidden, setHidden] = useState<boolean>(!!storeKey)

  useEffect(() => {
    if (!storeKey) return
    let alive = true
    SecureStore.getItemAsync(storeKey)
      .then((v) => {
        if (!alive) return
        const at = Number(v)
        setHidden(Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS)
      })
      .catch(() => alive && setHidden(false))
    return () => {
      alive = false
    }
  }, [storeKey])

  if (hidden) return null

  const atCap = used >= cap
  const showMeter = atCap || used >= Math.min(METER_FROM, cap)
  const title = atCap
    ? svText(sv, 'bannerCapTitle', p, locale, { used, cap })
    : showMeter
      ? sv.bannerTitle
      : sv.bannerOpenTitle
  const body = atCap ? sv.bannerCapBody : showMeter ? sv.bannerBody : sv.bannerOpenBody
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 100

  const dismiss = () => {
    setHidden(true)
    if (storeKey) SecureStore.setItemAsync(storeKey, String(Date.now())).catch(() => {})
  }

  return (
    <View style={[styles.ban, style]}>
      <View style={[styles.head, rowDir]}>
        <View style={[{ flex: 1 }, colDir]}>
          <Text style={[styles.title, dirStyle]}>{title}</Text>
          <Text style={[styles.body, dirStyle]}>{body}</Text>
        </View>
        {storeKey ? (
          <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={sv.dismiss}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ) : null}
      </View>

      {showMeter ? (
        <View>
          <View style={[styles.mt, rowDir]}>
            <Text style={[styles.mtText, dirStyle]}>{sv.bannerMeter}</Text>
            <Text style={[styles.mtText, dirStyle]}>{svText(sv, 'usedOf', p, locale, { used, cap })}</Text>
          </View>
          <View style={[styles.meter, rowDir]}>
            <View style={[styles.meterFill, { width: `${pct}%` }]} />
          </View>
        </View>
      ) : null}

      <StoreValueChips params={p} short onDark />

      <Button
        label={p.trialDays > 0 ? svText(sv, 'bannerCta', p, locale) : sv.capConvertCtaPlain}
        variant="y"
        size="sm"
        disabled={disabled}
        onPress={onConvert}
      />
      {PAID_UI_ENABLED ? (
        <Text style={[styles.then, { writingDirection: dirStyle.writingDirection }]}>
          {sv.bannerThen} <Text style={styles.thenBig}>{fmtPrice(p.price)}</Text> {sv.perMonthShort}
          {p.list > p.price ? (
            <>
              {' '}
              <Text style={styles.strike}>{fmtPrice(p.list)}</Text>
            </>
          ) : null}
        </Text>
      ) : null}
    </View>
  )
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    ban: {
      backgroundColor: c.hero,
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
      borderWidth: isDark ? 1 : 0,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    title: { fontFamily: fonts.black, fontSize: 16, color: c.white },
    body: { fontFamily: fonts.semiBold, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    mt: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    mtText: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },
    meter: {
      flexDirection: 'row',
      height: 7,
      borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.14)',
      overflow: 'hidden',
    },
    meterFill: { height: '100%', backgroundColor: c.y, borderRadius: 6 },
    then: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
    thenBig: { fontFamily: fonts.black, fontSize: 14, color: c.white },
    strike: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.4)' },
  })
}
