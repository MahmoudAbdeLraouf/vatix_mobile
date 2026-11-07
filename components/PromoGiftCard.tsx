import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { formatGiftDays } from '@/lib/promoGift'
import type { PromoGiftOffer, PromotionGiftItem } from '@/lib/promoGift'
import { Button } from '@/components/ui/Button'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'

interface Props {
  offer?: PromoGiftOffer | null
  gifts: PromotionGiftItem[]
  onPick: (gift: PromotionGiftItem) => void
}

/** My-ads banner: an available gift (pick a listing) or the add-N-listings progress. */
export function PromoGiftCard({ offer, gifts, onPick }: Props) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: 'auto' as const,
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  if (gifts.length > 0) {
    const gift = gifts[0]
    const isAdmin = gift.source === 'admin'
    const daysText = formatGiftDays(gift.days, ar ? 'ar' : 'en')
    const title = isAdmin
      ? ar ? '🎁 وصلتك هدية ترويج' : '🎁 You received a promotion gift'
      : ar
        ? `🎉 كسبت ترويج مجاني ${daysText}! اختار الإعلان`
        : `🎉 You earned a free ${daysText} promotion! Pick a listing`
    return (
      <View style={[styles.card, dirContainer]}>
        <View style={styles.textWrap}>
          <Text style={[styles.title, dirStyle]}>{title}</Text>
          {isAdmin && !!gift.note && <Text style={[styles.note, dirStyle]}>{gift.note}</Text>}
        </View>
        <Button
          label={ar ? 'اختار إعلان' : 'Pick a listing'}
          variant="y"
          size="sm"
          fullWidth={false}
          onPress={() => onPick(gift)}
        />
      </View>
    )
  }

  if (offer?.eligible) {
    const { threshold, productCount } = offer
    return (
      <View style={[styles.card, dirContainer]}>
        <View style={styles.textWrap}>
          <View style={[styles.dots, dirContainer]}>
            {Array.from({ length: threshold }, (_, i) => (
              <View key={i} style={[styles.dot, i < productCount && styles.dotFilled]} />
            ))}
          </View>
          <Text style={[styles.progress, dirStyle]}>
            {ar
              ? `أضفت ${productCount} من ${threshold} — كمّل وخد الترويج المجاني`
              : `You've added ${productCount} of ${threshold} — keep going to get the free promotion`}
          </Text>
        </View>
        <Button
          label={ar ? 'أضف إعلان' : 'Add listing'}
          variant="y"
          size="sm"
          fullWidth={false}
          onPress={() => router.push('/products/new' as never)}
        />
      </View>
    )
  }

  return null
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
  },
  textWrap: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.heading,
    lineHeight: 22,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.dot,
  },
  dotFilled: {
    backgroundColor: colors.y,
    borderColor: colors.y,
  },
  progress: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.heading,
    lineHeight: 22,
  },
})
