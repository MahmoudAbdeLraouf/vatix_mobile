import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { getStoreSalesRecord } from '@/lib/api'
import { relativeSaleDate, type PublicSalesRecord } from '@/lib/salesRecord'

interface Props {
  visible: boolean
  storeId: number
  onClose: () => void
}

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

/**
 * Bottom sheet with a store's public sales record. The headline shows the total
 * ("registered") and the buyer-confirmed count; loading/empty/error stay quiet.
 */
export function SalesRecordSheet({ visible, storeId, onClose }: Props) {
  const { t, locale, isRtl } = useLocale()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const [record, setRecord] = useState<PublicSalesRecord | null>(null)
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setState('loading')
    getStoreSalesRecord(storeId)
      .then(r => {
        if (cancelled) return
        setRecord(r)
        setState(r && r.total > 0 ? 'ready' : 'empty')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        // 404 = feature off or store has no record; both read as "nothing to show".
        setState((e as { status?: number })?.status === 404 ? 'empty' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [visible, storeId])

  const rowDir = isRtl ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const }) : null
  const dirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const s = t.salesRecord

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.header, rowDir]}>
            <Text style={[styles.title, dirStyle]} numberOfLines={1}>
              {s.sheetTitle}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={s.close}>
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {state === 'loading' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.y} />
              </View>
            ) : state === 'ready' && record ? (
              <>
                <View style={[styles.statsRow, rowDir]}>
                  <View style={[styles.stat, { backgroundColor: colors.yellowBg }]}>
                    <Text style={[styles.statNum, { color: colors.yellowText }]}>{record.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.yellowText }]}>{s.soldLabel}</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: colors.greenBg }]}>
                    <Text style={[styles.statNum, { color: colors.green }]}>{record.verified}</Text>
                    <Text style={[styles.statLabel, { color: colors.green }]}>{s.verifiedLabel}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, dirStyle]}>{s.howTitle}</Text>
                  <Text style={[styles.howText, dirStyle]}>{s.howRegistered}</Text>
                  <Text style={[styles.howText, dirStyle]}>{s.howConfirmed}</Text>
                </View>

                {record.recent.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, dirStyle]}>{s.recentTitle}</Text>
                    {record.recent.slice(0, 10).map((r, i) => (
                      <View key={`${r.soldAt}-${i}`} style={[styles.recentRow, rowDir]}>
                        <View style={styles.recentInfo}>
                          <Text style={[styles.recentTitle, dirStyle]} numberOfLines={1}>
                            {r.productTitle}
                          </Text>
                          <Text style={[styles.recentDate, dirStyle]}>
                            {relativeSaleDate(r.soldAt, locale)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tag,
                            { backgroundColor: r.verified ? colors.greenBg : colors.yellowBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tagText,
                              { color: r.verified ? colors.green : colors.yellowText },
                            ]}
                          >
                            {r.verified ? s.tagConfirmed : s.tagRegistered}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.note, { backgroundColor: colors.yellowBg }]}>
                  <Text style={[styles.noteText, dirStyle]}>{s.noCommission}</Text>
                </View>
              </>
            ) : (
              <View style={styles.center}>
                <Text style={[styles.emptyText, dirStyle]}>{s.empty}</Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '88%',
      overflow: 'hidden',
      ...(dark ? { borderTopWidth: 1, borderColor: colors.border } : null),
    },
    header: {
      backgroundColor: colors.hero,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { flex: 1, fontFamily: fonts.black, fontSize: 16, color: colors.white, marginEnd: spacing.md },
    body: { padding: spacing.lg, gap: spacing.md },
    center: { paddingVertical: spacing.lg, alignItems: 'center' },
    emptyText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.muted },
    statsRow: { flexDirection: 'row', gap: spacing.sm },
    stat: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 2 },
    statNum: { fontFamily: fonts.black, fontSize: 28, lineHeight: 36 },
    statLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    section: { gap: 6 },
    sectionTitle: { fontFamily: fonts.black, fontSize: 14, color: colors.heading },
    howText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.text },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    recentInfo: { flex: 1 },
    recentTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
    recentDate: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    tag: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
    tagText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 17 },
    note: { borderRadius: radius.md, padding: spacing.md },
    noteText: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 19, color: colors.yellowText },
  })
