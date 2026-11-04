import { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { fillTemplate, getMySalesRecord, nextTier, type OwnSalesRecord } from '@/lib/salesRecord'
import { Button } from '@/components/ui/Button'

/**
 * Store dashboard card: sold / verified counts, progress to the next tier and a
 * nudge for sales still awaiting buyer confirmation. Renders nothing while
 * loading, on error, or when the feature is off (the endpoint 404s).
 */
export function SalesRecordCard() {
  const { t, isRtl } = useLocale()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [record, setRecord] = useState<OwnSalesRecord | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      getMySalesRecord()
        .then(r => {
          if (!cancelled) setRecord(r)
        })
        .catch(() => {
          // Quiet by design: 404 = feature off, anything else is non-critical decoration.
          if (!cancelled) setRecord(null)
        })
      return () => {
        cancelled = true
      }
    }, []),
  )

  if (!record) return null

  const s = t.salesRecord
  const dirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const rowDir = isRtl ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const }) : null

  const next = nextTier(record.total)
  const tierLabels = { active: s.tierActive, trusted: s.tierTrusted, top: s.tierTop }
  const progress = next
    ? Math.min(100, Math.max(0, ((record.total - next.from) / (next.min - next.from)) * 100))
    : 100
  const awaiting = record.pending + record.notRequested

  return (
    <View style={styles.card}>
      <Text style={[styles.title, dirStyle]}>{s.dashTitle}</Text>

      <View style={[styles.statsRow, rowDir]}>
        <View style={[styles.stat, { backgroundColor: colors.yellowBg }]}>
          <Text style={[styles.statNum, { color: colors.yellowText }]}>{record.total}</Text>
          <Text style={[styles.statLabel, { color: colors.yellowText }]}>{s.dashSold}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.greenBg }]}>
          <Text style={[styles.statNum, { color: colors.green }]}>{record.verified}</Text>
          <Text style={[styles.statLabel, { color: colors.green }]}>{s.dashVerified}</Text>
        </View>
      </View>

      {next ? (
        <View style={styles.progressWrap}>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.y }]} />
          </View>
          <Text style={[styles.progressText, dirStyle]}>
            {fillTemplate(s.dashNextTier, { remaining: next.remaining, tier: tierLabels[next.label] })}
          </Text>
        </View>
      ) : null}

      {awaiting > 0 ? (
        <Pressable
          onPress={() => router.push('/dashboard/my-ads?tab=sold' as never)}
          style={[styles.pending, { backgroundColor: colors.yellowBg }]}
          accessibilityRole="button"
        >
          <Text style={[styles.pendingText, dirStyle]}>
            {fillTemplate(s.dashPending, { count: awaiting })}
          </Text>
        </Pressable>
      ) : null}

      <Button
        label={s.dashCta}
        variant="y"
        fullWidth
        onPress={() => router.push('/products/new')}
      />
      <Text style={[styles.foot, dirStyle]}>{s.dashNoCommission}</Text>
    </View>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    title: { fontFamily: fonts.black, fontSize: 15, color: colors.heading },
    statsRow: { flexDirection: 'row', gap: spacing.sm },
    stat: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 2 },
    statNum: { fontFamily: fonts.black, fontSize: 26, lineHeight: 34 },
    statLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    progressWrap: { gap: 6 },
    track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
    fill: { height: 8, borderRadius: radius.full },
    progressText: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 18, color: colors.muted },
    pending: { borderRadius: radius.md, padding: spacing.md },
    pendingText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: colors.yellowText },
    foot: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, color: colors.muted },
  })
