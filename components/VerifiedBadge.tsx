import React, { useEffect, useId, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import type { StoreVerification, VerificationCheck } from '@/lib/api'
import { useLocale } from '@/contexts/locale'
import { fonts, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const ORDER: VerificationCheck[] = ['phone', 'storefront', 'commercial_register', 'facebook']
const BLUE_TEXT = '#0B4FBF'
const ROSETTE =
  'M12 1.5l2.2 1.6 2.7-.3 1.1 2.5 2.5 1.1-.3 2.7L21.8 12l-1.6 2.2.3 2.7-2.5 1.1-1.1 2.5-2.7-.3L12 22.5l-2.2-1.6-2.7.3-1.1-2.5-2.5-1.1.3-2.7L2.2 12l1.6-2.2-.3-2.7 2.5-1.1 1.1-2.5 2.7.3z'

/**
 * Bro offers/matches only carry `verificationChecks`; a non-empty list means the
 * store is verified. This is the one place that rule lives.
 */
export function verificationFromChecks(checks?: VerificationCheck[] | null): StoreVerification | null {
  return checks && checks.length > 0 ? { verified: true, checks } : null
}

/** Blue scalloped seal with a white tick — the verified mark on its own. */
export function VerifiedSeal({ size = 15 }: { size?: number }) {
  const gid = `vseal-${useId().replace(/:/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3D8BFF" />
          <Stop offset="1" stopColor="#1257D6" />
        </LinearGradient>
      </Defs>
      <Path d={ROSETTE} fill={`url(#${gid})`} />
      <Path
        d="M7.6 12.3l3 3 5.8-6.1"
        fill="none"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Light sweep across the full pill every few seconds; off under Reduce Motion. */
function Shine({ width }: { width: number }) {
  const x = useRef(new Animated.Value(0)).current
  const [reduce, setReduce] = useState(true)

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((r) => alive && setReduce(r))
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (reduce || width <= 0) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reduce, width, x])

  if (reduce || width <= 0) return null
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-40, width + 40] })
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shine, { transform: [{ translateX }, { skewX: '-20deg' }] }]}
    />
  )
}

/**
 * Store verification badge. Light-blue pill with the blue seal so it never reads
 * as the navy/yellow Store Plus badge, and stays legible on the navy store hero
 * and in dark mode. Renders nothing for unverified or missing data. Flows
 * inline (never absolutely positioned). The pill only says "verified"; the
 * full variant reveals which checks passed on press.
 */
export function VerifiedBadge({
  verification,
  variant = 'compact',
}: {
  verification?: StoreVerification | null
  variant?: 'compact' | 'full'
}) {
  const { t, isRtl } = useLocale()
  const { colors, isDark } = useTheme()
  const [open, setOpen] = useState(false)
  const [pillWidth, setPillWidth] = useState(0)
  if (!verification?.verified) return null

  const v = t.verified
  const checks = ORDER.filter((c) => verification.checks.includes(c))
  const full = variant === 'full'
  const dir = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const pill = (
    <View
      style={[styles.pill, full ? styles.pillFull : styles.pillCompact]}
      onLayout={full ? (e) => setPillWidth(e.nativeEvent.layout.width) : undefined}
    >
      <VerifiedSeal size={full ? 16 : 14} />
      <Text style={[styles.text, full ? styles.textFull : styles.textCompact, dir]}>
        {full ? v.badgeFull : v.badge}
      </Text>
      {full ? <Shine width={pillWidth} /> : null}
    </View>
  )

  if (!full) return pill

  return (
    <View style={styles.fullWrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={v.tooltipTitle}
        accessibilityState={{ expanded: open }}
      >
        {pill}
      </Pressable>
      {open ? (
        <View style={[styles.tips, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.tipsHead}>
            <VerifiedSeal size={18} />
            <Text style={[styles.tipsTitle, { color: colors.text }, dir]}>{v.tooltipTitle}</Text>
          </View>
          {checks.map((c) => (
            <View key={c} style={styles.tipRow}>
              <View style={[styles.tipCheck, isDark && styles.tipCheckDark]}>
                <Text style={[styles.tipCheckText, isDark && styles.tipCheckTextDark]}>✓</Text>
              </View>
              <Text style={[styles.tip, { color: colors.muted }, dir]}>{v.tips[c]}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#EAF3FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BCD6FF',
    overflow: 'hidden',
  },
  pillCompact: { paddingHorizontal: 7, paddingVertical: 2 },
  pillFull: { paddingHorizontal: 11, paddingVertical: 4 },
  shine: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: 0,
    width: 24,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  text: { color: BLUE_TEXT, fontFamily: fonts.extraBold, includeFontPadding: false },
  textCompact: { fontSize: 11, lineHeight: 16 },
  textFull: { fontSize: 12, lineHeight: 17 },
  fullWrap: { alignSelf: 'flex-start', maxWidth: '100%', gap: spacing.xs },
  tips: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipsTitle: { fontFamily: fonts.bold, fontSize: 12, flexShrink: 1 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  tipCheck: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    marginTop: 1,
    backgroundColor: '#E7F8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCheckDark: { backgroundColor: 'rgba(18,184,134,0.18)' },
  tipCheckText: { fontFamily: fonts.bold, fontSize: 9, lineHeight: 12, color: '#06734B', includeFontPadding: false },
  tipCheckTextDark: { color: '#3DDC97' },
  tip: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, flexShrink: 1 },
})
