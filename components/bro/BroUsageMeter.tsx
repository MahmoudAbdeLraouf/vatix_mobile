import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useLocale } from '@/contexts/locale'
import type { BroUsage } from '@/lib/bro'
import { fonts, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useBroDir } from '@/components/bro/BroCardParts'
import { Button } from '@/components/ui/Button'
import { UpgradeModal } from '@/components/UpgradeModal'

const RED = '#dc2626'

/**
 * Monthly offer meter for clients. Stores (cap null) see nothing.
 * Slim one-row card; with `upgrade`, a full meter (free spent, nothing bought) becomes a compact
 * banner: switch to a store or buy offers.
 */
export function BroUsageMeter({ usage, style, upgrade = false }: { usage: BroUsage; style?: StyleProp<ViewStyle>; upgrade?: boolean }) {
  const { t, locale } = useLocale()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { dirStyle, rowDir } = useBroDir()
  const b = t.bro
  const { used, cap, purchased } = usage.offers
  if (cap == null || cap <= 0) return null

  const pct = Math.min(100, Math.round((used / cap) * 100))
  const full = used >= cap && purchased === 0
  const freeLeft = Math.max(cap - used, 0)
  const track = (
    <View
      style={[styles.track, full && upgrade ? styles.trackBanner : styles.trackSlim]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: cap, now: Math.min(used, cap) }}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: full ? RED : pct >= 80 ? '#f97316' : colors.y }]} />
    </View>
  )

  if (full && upgrade) {
    const reset = usage.resetsAt ? new Date(usage.resetsAt) : null
    const resetLabel = reset && !isNaN(reset.getTime())
      ? reset.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long' })
      : null
    return (
      <View style={[styles.banner, style]} accessibilityRole="alert">
        <View style={[styles.head, rowDir]}>
          <Text style={[styles.bannerTitle, dirStyle]}>
            {b.capBannerTitle.replace('{used}', String(used)).replace('{cap}', String(cap))}
          </Text>
          {resetLabel ? <Text style={[styles.count, dirStyle]}>{b.capBannerResets.replace('{date}', resetLabel)}</Text> : null}
        </View>
        {track}
        <View style={[styles.actions, rowDir]}>
          <Button label={b.capBannerStore} variant="y" size="sm" fullWidth={false} onPress={() => setShowUpgrade(true)} style={{ flex: 1.4 }} />
          <Button
            label={t.storeValue.offerCapPacksBuy}
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() => router.push('/dashboard/buy-offers' as never)}
            style={{ flex: 1 }}
          />
        </View>
        <UpgradeModal visible={showUpgrade} mode="upgrade-to-store" onClose={() => setShowUpgrade(false)} />
      </View>
    )
  }

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.head, rowDir]}>
        <Text style={[styles.label, dirStyle]}>{b.meterLabel}</Text>
        <Text style={[styles.count, dirStyle]}>
          <Text style={styles.countStrong}>{freeLeft}</Text>
          {' '}
          {b.meterLeftRest.replace('{cap}', String(cap)).replace('{purchased}', String(purchased))}
        </Text>
      </View>
      {track}
    </View>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  banner: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.heading },
  count: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  countStrong: { fontFamily: fonts.bold, color: colors.heading },
  bannerTitle: { fontFamily: fonts.black, fontSize: 13, color: RED, flexShrink: 1 },
  track: { height: 5, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  trackSlim: { marginTop: 6 },
  trackBanner: { marginTop: 7, marginBottom: 9 },
  fill: { height: '100%', borderRadius: 99 },
  actions: { flexDirection: 'row', gap: 8 },
})
