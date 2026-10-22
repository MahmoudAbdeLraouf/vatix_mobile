import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import type { BroRequest, BroRequestStatus, BroRequestView } from '@/lib/bro'
import { Button } from '@/components/ui/Button'
import { BroCountPills } from '@/components/bro/BroCountPills'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

/** One request: the card opens the request, the Offers button opens its offers list. Port of the website BroRequestCard. */
export function BroRequestRow({
  request: r,
  counts,
  offerCount,
}: {
  request: BroRequest
  counts?: BroRequestView['counts'] | null
  /** null while the count is still loading. */
  offerCount: number | null
}) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null
  const searching = r.status === 'searching'
  const hasOffers = (offerCount ?? 0) > 0

  const statusLabel: Record<BroRequestStatus, string> = {
    searching: b.statusSearching,
    done: b.statusDone,
    expired: b.statusExpired,
    cancelled: b.statusCancelled,
    found: b.statusFound,
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/bro/requests/${r.id}` as never)}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.rowTop, rowDir]}>
          <Text style={[styles.rowTitle, dirStyle]} numberOfLines={2}>
            {r.modelText}
            {r.storage ? ` · ${r.storage}` : ''}
          </Text>
          <View style={[styles.pill, searching ? styles.pillSearching : styles.pillIdle]}>
            <Text style={[styles.pillText, { color: searching ? colors.yt : colors.g700 }]}>{statusLabel[r.status]}</Text>
          </View>
        </View>
        <Text style={[styles.date, dirStyle]}>{new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-EG')}</Text>
        {counts ? (
          <View style={styles.countRow}>
            <BroCountPills counts={counts} />
          </View>
        ) : null}
      </Pressable>
      <Button
        label={b.viewOffers.replace('{n}', offerCount == null ? '…' : offerCount.toLocaleString(ar ? 'ar-EG' : 'en-EG'))}
        variant={hasOffers ? 'dk' : 'outline'}
        size="sm"
        fullWidth
        onPress={() => router.push(`/bro/request-offers/${r.id}` as never)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.ss,
  },
  main: { gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.dk },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillSearching: { backgroundColor: colors.yl },
  pillIdle: { backgroundColor: colors.g100 },
  pillText: { fontFamily: fonts.bold, fontSize: 11 },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500 },
  countRow: { marginTop: 4 },
})
