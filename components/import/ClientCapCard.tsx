import React, { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { UpgradeModal } from '@/components/UpgradeModal'
import { useLocale } from '@/contexts/locale'
import { authFetch } from '@/lib/auth'
import { TRIAL_DAYS } from '@/lib/trial'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

export type ImportScreen = 'shopify' | 'easyorders' | 'excel'

interface CapStatus {
  isCapped: boolean
  lifetimeCount: number
  baseCap: number
  extraSlots: number
  cap: number
  remaining: number
}

export function buySlotsForImportHref(screen: ImportScreen) {
  return `/dashboard/buy-slots?resumeTo=import&screen=${screen}`
}

// Advisory only — the server enforces the cap on confirm. Renders nothing for
// stores, while loading, or if the status request fails. Refetches on focus so
// coming back from buy-slots shows the new allowance.
export function ClientCapCard({ screen }: { screen: ImportScreen }) {
  const { t, locale } = useLocale()
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    direction: 'ltr' as const,
  }
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  const [status, setStatus] = useState<CapStatus | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      authFetch<CapStatus>('/store/products/import/cap-status')
        .then(s => {
          if (!cancelled) setStatus(s)
        })
        .catch(() => {
          if (!cancelled) setStatus(null)
        })
      return () => {
        cancelled = true
      }
    }, [reloadKey]),
  )

  if (!status || !status.isCapped || status.cap <= 0) return null

  const pct = Math.min(100, (status.lifetimeCount / status.cap) * 100)
  const full = status.remaining <= 0
  const barColor = full ? colors.red : pct >= 80 ? colors.orange : colors.y

  return (
    <View style={styles.card}>
      <View style={[styles.header, rowDir]}>
        <Text style={styles.title}>{ip.capTitle}</Text>
        <Text style={[styles.remaining, full && { color: colors.red }]}>
          {full ? ip.capFull : ip.capRemaining.replace('{remaining}', String(status.remaining))}
        </Text>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: status.cap, now: Math.min(status.lifetimeCount, status.cap) }}
      >
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: barColor },
            ar ? { alignSelf: 'flex-end' } : null,
          ]}
        />
      </View>

      <Text style={[styles.used, dirStyle]}>
        {ip.capUsed.replace('{count}', String(status.lifetimeCount)).replace('{cap}', String(status.cap))}
      </Text>
      <Text style={[styles.hint, dirStyle]}>{ip.capHint.replace('{cap}', String(status.baseCap))}</Text>

      <View style={[styles.actions, rowDir]}>
        <Button
          label={ip.capBuySlots}
          variant="y"
          size="sm"
          fullWidth={false}
          style={styles.action}
          onPress={() => router.push(buySlotsForImportHref(screen) as never)}
        />
        <Button
          label={ip.capConvertStore}
          variant="outline"
          size="sm"
          fullWidth={false}
          style={styles.action}
          onPress={() => setShowUpgrade(true)}
        />
      </View>
      <Text style={[styles.trialHint, dirStyle]}>
        {ip.capStoreTrialHint.replace('{days}', String(TRIAL_DAYS))}
      </Text>

      <UpgradeModal
        visible={showUpgrade}
        mode="upgrade-to-store"
        onClose={() => setShowUpgrade(false)}
        onSuccess={() => {
          setShowUpgrade(false)
          setReloadKey(k => k + 1)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  title: { fontFamily: fonts.black, fontSize: 15, color: colors.dk },
  remaining: { fontFamily: fonts.bold, fontSize: 13, color: colors.g600 },
  // Pinned to LTR so the fill's start edge is deterministic; Arabic fills from the right via alignSelf.
  track: { height: 10, borderRadius: radius.full, backgroundColor: colors.g200, overflow: 'hidden', direction: 'ltr' },
  fill: { height: '100%', borderRadius: radius.full },
  used: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.g700 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.g600 },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.xs },
  action: { flex: 1 },
  trialHint: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
})
