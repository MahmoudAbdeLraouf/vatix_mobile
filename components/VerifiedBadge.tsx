import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StoreVerification, VerificationCheck } from '@/lib/api'
import { useLocale } from '@/contexts/locale'
import { fonts, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const ORDER: VerificationCheck[] = ['phone', 'storefront', 'commercial_register', 'facebook']
const NAVY = '#1A2540'

/**
 * Bro offers/matches only carry `verificationChecks`; a non-empty list means the
 * store is verified. This is the one place that rule lives.
 */
export function verificationFromChecks(checks?: VerificationCheck[] | null): StoreVerification | null {
  return checks && checks.length > 0 ? { verified: true, checks } : null
}

/**
 * Store verification badge. Navy pill with a check mark so it never reads as the
 * yellow Featured badge. Renders nothing for unverified or missing data. Flows
 * inline (never absolutely positioned). There is no hover on touch, so the full
 * variant lists the passed checks as visible text and expands the explanation
 * on press.
 */
export function VerifiedBadge({
  verification,
  variant = 'compact',
}: {
  verification?: StoreVerification | null
  variant?: 'compact' | 'full'
}) {
  const { t, isRtl } = useLocale()
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  if (!verification?.verified) return null

  const v = t.verified
  const checks = ORDER.filter((c) => verification.checks.includes(c))
  const full = variant === 'full'
  const dir = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const pill = (
    <View style={[styles.pill, full ? styles.pillFull : styles.pillCompact]}>
      <Text style={[styles.text, full ? styles.textFull : styles.textCompact]}>✓</Text>
      <Text style={[styles.text, full ? styles.textFull : styles.textCompact, dir]}>{v.badge}</Text>
      {full && checks.length > 0 ? (
        <Text style={[styles.text, styles.labels, dir]}>
          · {checks.map((c) => v.labels[c]).join(' · ')}
        </Text>
      ) : null}
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
          <Text style={[styles.tipsTitle, { color: colors.text }, dir]}>{v.tooltipTitle}</Text>
          {checks.map((c) => (
            <Text key={c} style={[styles.tip, { color: colors.muted }, dir]}>
              {v.tips[c]}
            </Text>
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
    backgroundColor: NAVY,
    borderRadius: 999,
    // keeps the pill visible on navy surfaces (store hero, dark mode)
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pillCompact: { paddingHorizontal: 8, paddingVertical: 2 },
  pillFull: { paddingHorizontal: 10, paddingVertical: 3 },
  text: { color: '#fff', fontFamily: fonts.bold, includeFontPadding: false },
  textCompact: { fontSize: 11, lineHeight: 16 },
  textFull: { fontSize: 12, lineHeight: 17 },
  labels: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 17, opacity: 0.85 },
  fullWrap: { alignSelf: 'flex-start', maxWidth: '100%', gap: spacing.xs },
  tips: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  tipsTitle: { fontFamily: fonts.bold, fontSize: 12 },
  tip: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
})
