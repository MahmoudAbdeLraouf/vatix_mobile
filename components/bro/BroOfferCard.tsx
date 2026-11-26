import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import { budgetFitOf, type BroOfferView } from '@/lib/bro'
import { VerifiedBadge, verificationFromChecks } from '@/components/VerifiedBadge'
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
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

/** One seller offer. Same look as BroMatchCard; greyed with no connect button once unavailable. */
export function BroOfferCard({
  offer,
  cheapest,
  busy,
  disabled = false,
  now,
  onConnect,
  budgetMax = null,
  emphasized = false,
}: {
  offer: BroOfferView
  /** True for the first available offer (the list is sorted available-first, then by price). */
  cheapest: boolean
  /** This offer's own connect is in flight (shows the "connecting" label). */
  busy: boolean
  /** Another action on the page is in flight; the button is disabled without changing its label. */
  disabled?: boolean
  now: number
  onConnect: (offerId: number) => void
  /** The request's budget ceiling; when set, an available offer shows how it fits. */
  budgetMax?: number | null
  /** Top pick on the offers page: yellow border and a yellow chat button. */
  emphasized?: boolean
}) {
  const { t } = useLocale()
  const b = t.bro
  const { ar, dirStyle, rowDir } = useBroDir()
  const cardStyles = useCardStyles()
  const styles = themedStyles[useTheme().mode]
  const { ago, buildFacts } = useBroCardFormat(now)
  const facts = buildFacts({
    area: offer.locationName,
    scratches: offer.scratches,
    hasBox: offer.hasBox,
    hasInvoice: offer.hasInvoice,
    hasWarranty: offer.hasWarranty,
    warrantyNote: offer.warrantyNote,
  })

  const price = Number(offer.price)
  const fit = offer.available ? budgetFitOf(price, budgetMax) : null
  let fitLabel: string | null = null
  if (fit === 'in' && budgetMax != null) {
    const under = budgetMax - price
    fitLabel = under > 0 ? b.fitUnder.replace('{amount}', under.toLocaleString(ar ? 'ar-EG' : 'en-US')) : b.fitInBudget
  } else if (fit === 'near') fitLabel = b.fitNearBudget

  return (
    <View style={[styles.card, emphasized && offer.available && styles.cardEmph, !offer.available && styles.cardOff]}>
      <BroTagRow>
        {cheapest && offer.available ? <BroRibbon>{b.cheapest}</BroRibbon> : null}
        <BroPill>{offer.viaBro ? b.tagOfferBro : b.tagOffer}</BroPill>
        {!offer.available ? <BroPill muted>{b.unavailable}</BroPill> : null}
      </BroTagRow>

      <View style={[cardStyles.topRow, rowDir]}>
        <BroThumb src={offer.image} />
        <View style={cardStyles.info}>
          <Text style={[cardStyles.title, dirStyle]}>{offer.title}</Text>
          <View style={[cardStyles.priceRow, rowDir]}>
            <Text style={cardStyles.price}>{b.priceEgp.replace('{price}', price.toLocaleString())}</Text>
            {fitLabel ? (
              <View style={[styles.fit, fit === 'near' && styles.fitNear]}>
                <Text style={[styles.fitText, fit === 'near' && styles.fitTextNear]}>{fitLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={[cardStyles.sellerRow, rowDir]}>
            <Text style={[cardStyles.seller, cardStyles.sellerText, dirStyle]}>
              {offer.seller.name} · {ago(offer.createdAt)}
            </Text>
            <VerifiedBadge verification={verificationFromChecks(offer.seller.verificationChecks)} />
          </View>
        </View>
      </View>

      <BroFacts facts={facts} />

      {offer.sellerNote ? <BroSellerNote note={offer.sellerNote} /> : null}

      {offer.available ? (
        <BroButton
          label={busy ? b.connecting : b.chatSeller}
          variant={emphasized ? 'yellow' : 'dark'}
          size="md"
          icon="chatbubbles-outline"
          fullWidth
          disabled={busy || disabled}
          onPress={() => onConnect(offer.offerId)}
          dirStyle={dirStyle}
        />
      ) : null}
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
  cardEmph: { borderWidth: 2, borderColor: colors.y },
  cardOff: { opacity: 0.55 },
  fit: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.full, backgroundColor: dark ? colors.greenBg : '#e6f7ec' },
  fitNear: { backgroundColor: colors.yellowBg },
  fitText: { fontFamily: fonts.bold, fontSize: 11, color: dark ? colors.green : '#1a7f3c' },
  fitTextNear: { color: colors.yellowText },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
