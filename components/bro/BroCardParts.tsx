import type { ReactNode } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { imgUrl } from '@/lib/api'
import type { BroScratches } from '@/lib/bro'
import type { BroIconName } from '@/components/bro/BroButton'
import { darkColors, fonts, lightColors, radius, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

/** Presentational pieces shared by BroMatchCard and BroOfferCard so the two cards cannot drift apart. */

export interface BroFact {
  icon: BroIconName
  text: string
}

export interface BroFactInput {
  area?: string | null
  scratches?: BroScratches | null
  hasBox?: boolean | null
  hasInvoice?: boolean | null
  hasWarranty?: boolean | null
  warrantyNote?: string | null
}

/** RTL helpers every Bro card uses. */
export function useBroDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null
  // Text columns inside a rowDir row inherit its ltr direction; colDir restores rtl so 'auto' text sits right.
  const colDir = ar ? ({ direction: 'rtl' } as const) : null
  return { ar, dirStyle, rowDir, colDir }
}

/** Localised relative time ("منذ ...") and the fact chips for a match or an offer. */
export function useBroCardFormat(now: number) {
  const { t } = useLocale()
  const b = t.bro

  function ago(iso: string): string {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
    if (!Number.isFinite(mins) || mins < 1) return b.agoNow
    if (mins < 60) return b.agoMinutes.replace('{n}', String(mins))
    const hours = Math.floor(mins / 60)
    if (hours < 24) return b.agoHours.replace('{n}', String(hours))
    return b.agoDays.replace('{n}', String(Math.floor(hours / 24)))
  }

  function buildFacts(f: BroFactInput): BroFact[] {
    const scratchLabel: Record<BroScratches, string> = {
      none: b.scratchesNone,
      minor: b.scratchesMinor,
      repaired: b.scratchesRepaired,
    }
    return [
      f.area ? { icon: 'location-outline', text: b.factArea.replace('{area}', f.area) } : null,
      f.scratches ? { icon: 'phone-portrait-outline', text: scratchLabel[f.scratches] } : null,
      f.hasBox ? { icon: 'cube-outline', text: b.extraBox } : null,
      f.hasInvoice ? { icon: 'receipt-outline', text: b.extraInvoice } : null,
      f.hasWarranty
        ? {
            icon: 'shield-checkmark-outline',
            text: f.warrantyNote ? b.factWarranty.replace('{note}', f.warrantyNote) : b.extraWarranty,
          }
        : null,
    ].filter((x): x is BroFact => x !== null)
  }

  return { ago, buildFacts }
}

/** Small yellow pill (price drop, source tag). `muted` gives the grey variant (e.g. "unavailable"). */
export function BroPill({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { colors, mode } = useTheme()
  const styles = themedStyles[mode].parts
  return (
    <View style={[styles.pill, muted ? styles.pillMuted : styles.pillOn]}>
      <Text style={[styles.pillText, { color: muted ? colors.text : colors.yellowText }]}>{children}</Text>
    </View>
  )
}

/** Solid yellow "cheapest" ribbon. */
export function BroRibbon({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.ribbon}>
      <Text style={styles.ribbonText}>{children}</Text>
    </View>
  )
}

/** Wrapping row that holds the ribbon and tag pills at the top of a card. Renders nothing when empty. */
export function BroTagRow({ children }: { children: ReactNode }) {
  const { rowDir } = useBroDir()
  const styles = useStyles()
  return <View style={[styles.tagRow, rowDir]}>{children}</View>
}

/** 72x72 product thumbnail. */
export function BroThumb({ src }: { src: string | null | undefined }) {
  const image = imgUrl(src, { w: 144 })
  const styles = useStyles()
  return <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={styles.thumbImg} /> : null}</View>
}

/** Two-column grid of fact chips (area, scratches, box, ...). Renders nothing when empty. */
export function BroFacts({ facts }: { facts: BroFact[] }) {
  const { dirStyle, rowDir } = useBroDir()
  const { colors, mode } = useTheme()
  const styles = themedStyles[mode].parts
  if (facts.length === 0) return null
  return (
    <View style={[styles.facts, rowDir]}>
      {facts.map(f => (
        <View key={f.icon} style={[styles.fact, rowDir]}>
          <Ionicons name={f.icon} size={14} color={colors.muted} />
          <Text style={[styles.factText, dirStyle]} numberOfLines={2}>
            {f.text}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** The seller's quoted note. */
export function BroSellerNote({ note }: { note: string }) {
  const { t } = useLocale()
  const { dirStyle } = useBroDir()
  const styles = useStyles()
  return <Text style={[styles.note, dirStyle]}>{t.bro.sellerQuote.replace('{note}', note)}</Text>
}

const makeCardStyles = (colors: ThemeColors) => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.heading },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  price: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.price },
  seller: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
})

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillOn: { backgroundColor: colors.yellowBg },
  pillMuted: { backgroundColor: colors.placeholder },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  ribbon: { backgroundColor: colors.y, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  ribbonText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.dk },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.placeholder },
  thumbImg: { width: 72, height: 72 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 6 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48.5%',
    backgroundColor: colors.placeholder,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  factText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.placeholder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
})

const themedStyles = {
  light: { parts: makeStyles(lightColors), card: makeCardStyles(lightColors) },
  dark: { parts: makeStyles(darkColors), card: makeCardStyles(darkColors) },
}

function useStyles() {
  return themedStyles[useTheme().mode].parts
}

/** Layout styles shared by BroMatchCard and BroOfferCard (top row, title, price, seller). */
export function useCardStyles() {
  return themedStyles[useTheme().mode].card
}
