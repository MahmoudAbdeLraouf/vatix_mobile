import { Image, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { imgUrl } from '@/lib/api'
import type { BroMatchView, BroScratches } from '@/lib/bro'
import { Ionicons } from '@expo/vector-icons'
import { BroButton, type BroIconName } from '@/components/bro/BroButton'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

/** One seller-confirmed match. The parent owns the connect call and its in-flight guard. */
export function BroMatchCard({
  match,
  busy,
  now,
  onConnect,
}: {
  match: BroMatchView
  busy: boolean
  now: number
  onConnect: (inquiryId: number) => void
}) {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null
  const { product } = match

  const scratchLabel: Record<BroScratches, string> = {
    none: b.scratchesNone,
    minor: b.scratchesMinor,
    repaired: b.scratchesRepaired,
  }

  function ago(iso: string): string {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
    if (!Number.isFinite(mins) || mins < 1) return b.agoNow
    if (mins < 60) return b.agoMinutes.replace('{n}', String(mins))
    const hours = Math.floor(mins / 60)
    if (hours < 24) return b.agoHours.replace('{n}', String(hours))
    return b.agoDays.replace('{n}', String(Math.floor(hours / 24)))
  }

  const price = match.latestPrice ?? product.price
  const image = imgUrl(product.image, { w: 144 })
  const area = match.checkArea ?? product.locationName
  const facts = [
    area ? { icon: 'location-outline', text: b.factArea.replace('{area}', area) } : null,
    match.scratches ? { icon: 'phone-portrait-outline', text: scratchLabel[match.scratches] } : null,
    match.hasBox ? { icon: 'cube-outline', text: b.extraBox } : null,
    match.hasInvoice ? { icon: 'receipt-outline', text: b.extraInvoice } : null,
    match.hasWarranty
      ? {
          icon: 'shield-checkmark-outline',
          text: match.warrantyNote ? b.factWarranty.replace('{note}', match.warrantyNote) : b.extraWarranty,
        }
      : null,
  ].filter((f): f is { icon: BroIconName; text: string } => f !== null)

  return (
    <View style={styles.card}>
      {match.isCheapest ? (
        <View style={[styles.ribbon, { alignSelf: ar ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.ribbonText}>{b.cheapestRibbon}</Text>
        </View>
      ) : null}

      <View style={[styles.matchTop, rowDir]}>
        <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={styles.thumbImg} /> : null}</View>
        <View style={styles.matchInfo}>
          <Text style={[styles.matchTitle, dirStyle]}>{product.title}</Text>
          <View style={[styles.priceRow, rowDir]}>
            <Text style={styles.price}>{b.priceEgp.replace('{price}', price.toLocaleString())}</Text>
            {match.priceDrop != null && match.priceDrop > 0 ? (
              <View style={[styles.pill, styles.pillOn]}>
                <Text style={[styles.pillText, { color: colors.yt }]}>
                  {b.priceDrop.replace('{amount}', match.priceDrop.toLocaleString())}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.seller, dirStyle]}>
            {match.seller.displayName} · {b.factAvailable.replace('{ago}', ago(match.answeredAt))}
          </Text>
        </View>
      </View>

      {facts.length > 0 ? (
        <View style={[styles.facts, rowDir]}>
          {facts.map(f => (
            <View key={f.icon} style={[styles.fact, rowDir]}>
              <Ionicons name={f.icon} size={14} color={colors.g500} />
              <Text style={[styles.factText, dirStyle]} numberOfLines={2}>
                {f.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {match.sellerNote ? (
        <Text style={[styles.note, dirStyle]}>{b.sellerQuote.replace('{note}', match.sellerNote)}</Text>
      ) : null}

      <View style={[styles.actions, rowDir]}>
        <View style={styles.primary}>
          <BroButton
            label={busy ? b.connecting : b.chatSeller}
            variant="dark"
            size="md"
            icon="chatbubbles-outline"
            fullWidth
            disabled={busy}
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
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  primary: { flex: 1 },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillOn: { backgroundColor: colors.yl },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  ribbon: { backgroundColor: colors.y, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  ribbonText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.dk },
  matchTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.g100 },
  thumbImg: { width: 72, height: 72 },
  matchInfo: { flex: 1, minWidth: 0 },
  matchTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.dk },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  price: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.dk },
  seller: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500, marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 6 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48.5%',
    backgroundColor: colors.g100,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  factText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 12, color: colors.g700 },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g700,
    backgroundColor: colors.g100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
})
