import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import type { ImportPreviewError } from '@/lib/import'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

// Preview errors grouped by row number.
export function ImportErrors({ errors }: { errors: ImportPreviewError[] }) {
  const { t, locale } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const ip = t.importProducts
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    // Pin the Text's own direction so 'right' isn't double-flipped by the inherited RTL root.
    direction: 'ltr' as const,
  }

  const groups = useMemo(() => {
    const map = new Map<number, ImportPreviewError[]>()
    for (const e of errors) {
      const list = map.get(e.rowNumber) ?? []
      list.push(e)
      map.set(e.rowNumber, list)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [errors])

  if (errors.length === 0) return null

  return (
    <View style={styles.box}>
      <Text style={[styles.heading, dirStyle]}>
        {ip.errorsHeading} ({errors.length})
      </Text>
      {groups.map(([row, list]) => (
        <View key={row} style={styles.group}>
          <Text style={[styles.row, dirStyle]}>{ip.rowLabel.replace('{row}', String(row))}</Text>
          {list.map((e, i) => (
            <Text key={i} style={[styles.msg, dirStyle]}>
              • {e.field ? `${e.field}: ` : ''}
              {e.message}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  box: {
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.redBg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: dark ? 'rgba(229,62,62,0.35)' : '#FED7D7',
  },
  heading: { fontFamily: fonts.bold, fontSize: 14, color: colors.red },
  group: { gap: 2 },
  row: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.heading },
  msg: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },
})
