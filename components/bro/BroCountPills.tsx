import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import type { BroRequestView } from '@/lib/bro'
import { colors, fonts, radius } from '@/constants/theme'

/** Available / pending / sold counts as semantic pills: green = live, amber = waiting, struck grey = gone. */
export function BroCountPills({ counts }: { counts: BroRequestView['counts'] }) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null
  const nfmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')

  return (
    <View style={[styles.row, rowDir]}>
      <View style={[styles.pill, styles.available]}>
        <Text style={[styles.text, styles.availableText]}>{`${b.pillAvailable} ${nfmt(counts.available)}`}</Text>
      </View>
      <View style={[styles.pill, styles.pending]}>
        <Text style={[styles.text, styles.pendingText]}>{`${b.pillPending} ${nfmt(counts.pending)}`}</Text>
      </View>
      <View style={[styles.pill, styles.sold]}>
        <Text style={[styles.text, styles.soldText]}>{`${b.pillSold} ${nfmt(counts.sold)}`}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontFamily: fonts.bold, fontSize: 12 },
  available: { backgroundColor: colors.gl },
  availableText: { color: colors.green },
  pending: { backgroundColor: colors.yl },
  pendingText: { color: colors.yt },
  sold: { backgroundColor: colors.g100 },
  soldText: { color: colors.g500, textDecorationLine: 'line-through' },
})
