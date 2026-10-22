import { Image, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { imgUrl } from '@/lib/api'
import type { BroMatchView, BroScratches } from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
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
  const facts: string[] = [
    area ? `📍 ${b.factArea.replace('{area}', area)}` : '',
    match.scratches ? `🔍 ${scratchLabel[match.scratches]}` : '',
    match.hasBox ? `📦 ${b.extraBox}` : '',
    match.hasInvoice ? `🧾 ${b.extraInvoice}` : '',
    match.hasWarranty
      ? `🛡️ ${match.warrantyNote ? b.factWarranty.replace('{note}', match.warrantyNote) : b.extraWarranty}`
      : '',
  ].filter(Boolean)

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
                <Text style={[styles.pillText, { color: '#8a6500' }]}>
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
        <View style={styles.facts}>
          {facts.map(f => (
            <Text key={f} style={[styles.fact, dirStyle]}>
              {f}
            </Text>
          ))}
        </View>
      ) : null}

      {match.sellerNote ? (
        <Text style={[styles.note, dirStyle]}>{b.sellerQuote.replace('{note}', match.sellerNote)}</Text>
      ) : null}

      <View style={[styles.chips, rowDir]}>
        <BroButton
          label={busy ? b.connecting : b.chatSeller}
          variant="dark"
          disabled={busy}
          onPress={() => onConnect(match.inquiryId)}
          dirStyle={dirStyle}
        />
        <BroButton label={b.viewAd} onPress={() => router.push(`/products/${product.id}` as never)} dirStyle={dirStyle} />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillOn: { backgroundColor: '#fff8e1' },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  ribbon: { backgroundColor: '#F5B800', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  ribbonText: { fontFamily: fonts.extraBold, fontSize: 12, color: '#1A2540' },
  matchTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.g100 },
  thumbImg: { width: 72, height: 72 },
  matchInfo: { flex: 1, minWidth: 0 },
  matchTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#1A2540' },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  price: { fontFamily: fonts.extraBold, fontSize: 16, color: '#1A2540' },
  seller: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500, marginTop: 2 },
  facts: { gap: 4 },
  fact: { fontFamily: fonts.regular, fontSize: 13, color: colors.g700 },
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
