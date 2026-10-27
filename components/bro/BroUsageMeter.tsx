import { useMemo, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useLocale } from '@/contexts/locale'
import type { BroUsage } from '@/lib/bro'
import { fonts, radius, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useBroDir } from '@/components/bro/BroCardParts'
import { BroButton } from '@/components/bro/BroButton'
import { UpgradeModal } from '@/components/UpgradeModal'

/**
 * Monthly offer meter for clients. Stores (cap null) see nothing.
 * With `upgrade`, a full meter also explains the limit and offers the store upgrade.
 */
export function BroUsageMeter({ usage, style, upgrade = false }: { usage: BroUsage; style?: StyleProp<ViewStyle>; upgrade?: boolean }) {
  const { t, locale } = useLocale()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { dirStyle, rowDir } = useBroDir()
  const b = t.bro
  const { used, cap } = usage.offers
  if (cap == null || cap <= 0) return null

  const pct = Math.min(100, Math.round((used / cap) * 100))
  const full = used >= cap
  const fill = full ? '#dc2626' : pct >= 80 ? '#f97316' : colors.y

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.head, rowDir]}>
        <Text style={[styles.label, dirStyle]}>{b.meterLabel}</Text>
        <Text style={[styles.count, dirStyle]}>
          {b.meter.replace('{used}', String(used)).replace('{cap}', String(cap))}
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: cap, now: Math.min(used, cap) }}
      >
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
      {full && upgrade ? (
        <View style={styles.capBox} accessibilityRole="alert">
          <Text style={[styles.capTitle, dirStyle]}>{b.capBlockTitle}</Text>
          <Text style={[styles.capBody, dirStyle]}>{b.capReached.replace('{date}', resetDate(usage.resetsAt, locale))}</Text>
          <Text style={[styles.capBody, dirStyle]}>{b.upgradeNudge}</Text>
          <BroButton label={b.capUpgradeCta} variant="yellow" size="md" onPress={() => setShowUpgrade(true)} />
        </View>
      ) : null}
      {upgrade ? <UpgradeModal visible={showUpgrade} mode="upgrade-to-store" onClose={() => setShowUpgrade(false)} /> : null}
    </View>
  )
}

function resetDate(iso: string, locale: string): string {
  const d = new Date(iso)
  try {
    return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' })
  } catch {
    return d.toLocaleDateString()
  }
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.heading },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  track: { height: 10, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  capBox: { marginTop: 12, gap: 6 },
  capTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#dc2626' },
  capBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 20 },
})
