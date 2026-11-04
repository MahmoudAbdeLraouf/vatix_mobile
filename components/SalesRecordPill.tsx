import { useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { fonts, radius, type ThemeColors } from '@/constants/theme'
import { fillTemplate } from '@/lib/salesRecord'

interface Props {
  /** Total sales on Vatix. The pill renders nothing for a missing/zero total. */
  total: number | null | undefined
  /** Opens the sales sheet. Without it the pill is static. */
  onOpen?: () => void
  /** 'link' = underlined inline text for the seller card, 'pill' = yellow chip. */
  variant?: 'pill' | 'link'
}

export function SalesRecordPill({ total, onOpen, variant = 'pill' }: Props) {
  const { t, isRtl } = useLocale()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  if (!total || total <= 0) return null

  const dirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  if (variant === 'link') {
    return (
      <Pressable onPress={onOpen} disabled={!onOpen} hitSlop={6} accessibilityRole="button">
        <Text style={[styles.link, dirStyle]}>
          {fillTemplate(t.salesRecord.sellerCard, { n: total })}
        </Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      style={styles.pill}
    >
      <Text style={[styles.pillText, dirStyle]} numberOfLines={1}>
        {fillTemplate(t.salesRecord.pill, { n: total })}
      </Text>
    </Pressable>
  )
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.yellowBg,
      borderWidth: 1,
      borderColor: colors.y,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    pillText: {
      fontFamily: fonts.bold,
      fontSize: 12,
      lineHeight: 18,
      color: colors.yellowText,
    },
    link: {
      fontFamily: fonts.bold,
      fontSize: 12,
      lineHeight: 18,
      color: colors.yellowText,
      textDecorationLine: 'underline',
    },
  })
