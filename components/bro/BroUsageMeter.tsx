import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import type { BroUsage } from '@/lib/bro'
import { colors, fonts, radius } from '@/constants/theme'
import { useBroDir } from '@/components/bro/BroCardParts'

/** Monthly offer meter for clients. Stores (cap null) see nothing. */
export function BroUsageMeter({ usage }: { usage: BroUsage }) {
  const { t } = useLocale()
  const { dirStyle, rowDir } = useBroDir()
  const b = t.bro
  const { used, cap } = usage.offers
  if (cap == null || cap <= 0) return null

  const pct = Math.min(100, Math.round((used / cap) * 100))
  const fill = used >= cap ? '#dc2626' : pct >= 80 ? '#f97316' : colors.y

  return (
    <View style={styles.card}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.dk },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.g600 },
  track: { height: 10, backgroundColor: colors.g200, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
})
