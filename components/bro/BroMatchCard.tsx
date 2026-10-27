import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import type { BroMatchView } from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
import {
  BroFacts,
  BroPill,
  BroRibbon,
  BroSellerNote,
  BroTagRow,
  BroThumb,
  useCardStyles,
  useBroCardFormat,
  useBroDir,
} from '@/components/bro/BroCardParts'
import { darkColors, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

/** One seller-confirmed match. The parent owns the connect call and its in-flight guard. */
export function BroMatchCard({
  match,
  busy,
  disabled = false,
  now,
  showBroTag = false,
  onConnect,
}: {
  match: BroMatchView
  busy: boolean
  /** Another action on the page is in flight; the button is disabled without changing its label. */
  disabled?: boolean
  now: number
  /** Tag the card "found by Geeko" when it is listed beside seller offers. */
  showBroTag?: boolean
  onConnect: (inquiryId: number) => void
}) {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const cardStyles = useCardStyles()
  const styles = themedStyles[useTheme().mode]
  const { ago, buildFacts } = useBroCardFormat(now)
  const { product } = match

  const price = match.latestPrice ?? product.price
  const facts = buildFacts({
    area: match.checkArea ?? product.locationName,
    scratches: match.scratches,
    hasBox: match.hasBox,
    hasInvoice: match.hasInvoice,
    hasWarranty: match.hasWarranty,
    warrantyNote: match.warrantyNote,
  })

  return (
    <View style={styles.card}>
      {match.isCheapest || showBroTag ? (
        <BroTagRow>
          {match.isCheapest ? <BroRibbon>{b.cheapestRibbon}</BroRibbon> : null}
          {showBroTag ? <BroPill>{b.tagOfferBro}</BroPill> : null}
        </BroTagRow>
      ) : null}

      <View style={[cardStyles.topRow, rowDir]}>
        <BroThumb src={product.image} />
        <View style={cardStyles.info}>
          <Text style={[cardStyles.title, dirStyle]}>{product.title}</Text>
          <View style={[cardStyles.priceRow, rowDir]}>
            <Text style={cardStyles.price}>{b.priceEgp.replace('{price}', price.toLocaleString())}</Text>
            {match.priceDrop != null && match.priceDrop > 0 ? (
              <BroPill>{b.priceDrop.replace('{amount}', match.priceDrop.toLocaleString())}</BroPill>
            ) : null}
          </View>
          <Text style={[cardStyles.seller, dirStyle]}>
            {match.seller.displayName} · {b.factAvailable.replace('{ago}', ago(match.answeredAt))}
          </Text>
        </View>
      </View>

      <BroFacts facts={facts} />

      {match.sellerNote ? <BroSellerNote note={match.sellerNote} /> : null}

      <View style={[styles.actions, rowDir]}>
        <View style={styles.primary}>
          <BroButton
            label={busy ? b.connecting : b.chatSeller}
            variant="dark"
            size="md"
            icon="chatbubbles-outline"
            fullWidth
            disabled={busy || disabled}
            onPress={() => onConnect(match.inquiryId)}
            dirStyle={dirStyle}
          />
        </View>
        <BroButton
          label={b.viewAd}
          size="md"
          onPress={() => router.push(`/products/${product.id}` as never)}
          dirStyle={dirStyle}
        />
      </View>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 10,
    ...(dark ? null : shadow.ss),
  },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  primary: { flex: 1 },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
