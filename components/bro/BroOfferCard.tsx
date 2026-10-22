import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import type { BroOfferView } from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
import {
  BroFacts,
  BroPill,
  BroRibbon,
  BroSellerNote,
  BroTagRow,
  BroThumb,
  cardStyles,
  useBroCardFormat,
  useBroDir,
} from '@/components/bro/BroCardParts'
import { colors, radius, shadow, spacing } from '@/constants/theme'

/** One seller offer. Same look as BroMatchCard; greyed with no connect button once unavailable. */
export function BroOfferCard({
  offer,
  cheapest,
  busy,
  disabled = false,
  now,
  onConnect,
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
}) {
  const { t } = useLocale()
  const b = t.bro
  const { dirStyle, rowDir } = useBroDir()
  const { ago, buildFacts } = useBroCardFormat(now)
  const facts = buildFacts({
    area: offer.locationName,
    scratches: offer.scratches,
    hasBox: offer.hasBox,
    hasInvoice: offer.hasInvoice,
    hasWarranty: offer.hasWarranty,
    warrantyNote: offer.warrantyNote,
  })

  return (
    <View style={[styles.card, !offer.available && styles.cardOff]}>
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
            <Text style={cardStyles.price}>{b.priceEgp.replace('{price}', Number(offer.price).toLocaleString())}</Text>
          </View>
          <Text style={[cardStyles.seller, dirStyle]}>
            {offer.seller.name} · {ago(offer.createdAt)}
          </Text>
        </View>
      </View>

      <BroFacts facts={facts} />

      {offer.sellerNote ? <BroSellerNote note={offer.sellerNote} /> : null}

      {offer.available ? (
        <BroButton
          label={busy ? b.connecting : b.chatSeller}
          variant="dark"
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: 10,
    ...shadow.ss,
  },
  cardOff: { opacity: 0.55 },
})
