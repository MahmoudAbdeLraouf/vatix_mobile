import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import { imgUrl } from '@/lib/api'
import { hasActiveOffer, type BoardMatchReason, type BroBoardItem, type BudgetFit } from '@/lib/bro'
import { useBroCardFormat, useBroDir } from '@/components/bro/BroCardParts'
import { darkColors, fonts, lightColors, shadow, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

/** Emoji + tint per category, matched on the localised category name (ar or en). */
const CATEGORY_ICONS: { re: RegExp; icon: string; bg: string }[] = [
  { re: /موبايل|هاتف|تليفون|phone|mobile/i, icon: '📱', bg: '#dde8ff' },
  { re: /لابتوب|لاب توب|laptop|كمبيوتر|computer/i, icon: '💻', bg: '#e6dfff' },
  { re: /تابلت|ايباد|آيباد|tablet|ipad/i, icon: '📲', bg: '#d6f4e6' },
  { re: /ساع|watch/i, icon: '⌚', bg: '#ffdee3' },
  { re: /سماع|اكسسوار|إكسسوار|headphone|accessor/i, icon: '🎧', bg: '#ffe9d2' },
  { re: /العاب|ألعاب|بلايستيشن|console|gaming/i, icon: '🎮', bg: '#d5edff' },
  { re: /كاميرا|camera/i, icon: '📷', bg: '#eeeded' },
  { re: /شاش|تلفزيون|tv|monitor/i, icon: '🖥️', bg: '#e9eef4' },
]

export function categoryIcon(name: string | null | undefined): { icon: string; bg: string } {
  const hit = name ? CATEGORY_ICONS.find(c => c.re.test(name)) : undefined
  return hit ?? { icon: '📦', bg: '#f0f2f5' }
}

const FRESH_MS = 60 * 60 * 1000

const SCORE_BG: Record<BoardMatchReason, string> = {
  product: '#12B886', saved: '#2952cc', category: '#667085', brand: '#667085',
}

const FIT_COLOR: Record<BudgetFit, string> = { in: '#0b7a52', near: '#b45309', over: '#c2410c' }

export type BroOfferPick = { kind: 'product' | 'saved'; id: number }

/** One buy request on the offers board. `pick` opens the sheet straight on that listing / saved offer. */
export function BroBoardCard({ item, onMakeOffer }: {
  item: BroBoardItem
  onMakeOffer: (item: BroBoardItem, pick?: BroOfferPick) => void
}) {
  const { t, locale } = useLocale()
  const { ar, dirStyle, rowDir, colDir } = useBroDir()
  const { colors, isDark } = useTheme()
  const styles = themedStyles[isDark ? 'dark' : 'light']
  const b = t.bro
  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')

  const now = Date.now()
  const { ago } = useBroCardFormat(now)
  const fresh = now - new Date(item.createdAt).getTime() < FRESH_MS

  const min = item.budgetMin != null ? Number(item.budgetMin) : null
  const max = item.budgetMax != null ? Number(item.budgetMax) : null
  const budget =
    min != null && max != null
      ? b.budgetAmtRange.replace('{min}', nf(min)).replace('{max}', nf(max))
      : max != null
        ? b.budgetAmtUpTo.replace('{max}', nf(max))
        : min != null
          ? b.budgetAmtFrom.replace('{min}', nf(min))
          : null

  // Buyers type bare numbers ("128"); give them a unit.
  const storage = item.storage
    ? /^\d+$/.test(item.storage.trim())
      ? `${nf(Number(item.storage))} ${b.storageUnit}`
      : item.storage
    : null
  const meta = [item.categoryName, item.brandName].filter(Boolean).join(' · ')

  const wantLabel = { cheaper: b.wantCheaper, better_condition: b.wantBetterCondition, with_box: b.wantWithBox }
  const wants = [
    ...(storage ? [storage] : []),
    ...(item.wants.length ? item.wants.map(w => wantLabel[w] ?? w) : [b.anyCondition]),
  ]

  const noOffers = item.offerCount <= 0
  const offers =
    noOffers ? null
    : item.offerCount === 1 ? b.offersCountOne
    : b.offersCount.replace('{n}', nf(item.offerCount))
  const canOffer = !item.isMine && !hasActiveOffer(item)
  const sent = !item.isMine && !canOffer
  const { icon, bg } = categoryIcon(item.categoryName)

  const chipText: Record<BoardMatchReason, string> = {
    product: `✓ ${b.chipHaveProduct}`, saved: b.chipHaveSaved, category: b.chipCategory, brand: b.chipBrand,
  }
  const fitText: Record<BudgetFit, string> = { in: b.fitIn, near: b.fitNear, over: b.fitOver }
  const chip = canOffer && item.matchReason ? item.matchReason : null
  const matched = canOffer ? item.matched ?? null : null
  const matchedImg = matched ? imgUrl(matched.image, { w: 120 }) : null

  const hot = noOffers && canOffer
  const ribbon = hot
    ? { bg: isDark ? 'rgba(245,184,0,0.16)' : colors.yl, fg: isDark ? colors.y : '#8a5a00' }
    : sent ? { bg: isDark ? 'rgba(18,184,134,0.14)' : '#EBFBEE', fg: isDark ? '#4ade80' : '#0b7a52' }
    : { bg: isDark ? colors.placeholder : colors.g100, fg: colors.muted }

  return (
    <View style={[styles.card, hot && styles.cardHot, sent && styles.cardSent]}>
      {chip ? (
        // The card is pinned to ltr, so the end edge is picked by hand.
        <View style={[styles.score, { backgroundColor: SCORE_BG[chip] }, ar ? { left: 16 } : { right: 16 }]}>
          <Text style={styles.scoreText}>{chipText[chip]}</Text>
        </View>
      ) : null}

      <View style={[styles.ribbon, rowDir, { backgroundColor: ribbon.bg }, chip ? { paddingTop: 16 } : null]}>
        <View style={[styles.ribbonStart, rowDir]}>
          {hot ? (
            <View style={styles.bolt}>
              <Text style={styles.boltText}>⚡</Text>
            </View>
          ) : null}
          <Text style={[styles.ribbonText, { color: ribbon.fg }]} numberOfLines={1}>
            {hot ? b.ribbonFirst : sent ? `✓ ${b.offerSent}` : (offers ?? b.offersCountNone)}
          </Text>
        </View>
        <Text style={[styles.time, hot && fresh ? { color: '#b45309' } : null]}>{ago(item.createdAt)}</Text>
      </View>

      <View style={[styles.head, rowDir]}>
        <View style={[styles.tile, { backgroundColor: isDark ? colors.placeholder : bg }]}>
          <Text style={styles.tileEmoji}>{icon}</Text>
        </View>
        <View style={[styles.headText, colDir]}>
          {meta ? (
            <Text style={[styles.meta, dirStyle]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <Text style={[styles.title, dirStyle]} numberOfLines={2}>
            {item.modelText}
          </Text>
          <View style={[styles.wants, rowDir]}>
            {wants.map(w => (
              <View key={w} style={styles.want}>
                <Text style={styles.wantText}>{w}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.budget, budget ? styles.budgetSet : styles.budgetOpenBox]}>
        <Text style={[styles.budgetLabel, dirStyle, budget ? styles.budgetLabelSet : null]}>{b.budgetBarBuyer}</Text>
        {budget ? (
          <Text style={[styles.budgetAmt, dirStyle]} numberOfLines={1}>
            {budget} <Text style={styles.budgetCur}>{b.budgetCurrency}</Text>
          </Text>
        ) : (
          <Text style={[styles.budgetOpen, dirStyle]}>{b.budgetOpen}</Text>
        )}
      </View>

      {item.locationName ? (
        <Text style={[styles.loc, dirStyle]}>📍 {b.cardInArea.replace('{area}', item.locationName)}</Text>
      ) : null}

      {matched ? (
        <View style={[styles.matched, rowDir]}>
          {matchedImg ? (
            <Image source={{ uri: matchedImg }} style={styles.matchedImg} />
          ) : (
            <View style={[styles.matchedImg, styles.matchedPh, { backgroundColor: matched.kind === 'saved' ? '#ffe28a' : '#3a404c' }]}>
              <Text style={styles.matchedPhText}>{matched.kind === 'saved' ? '📄' : ''}</Text>
            </View>
          )}
          <View style={[styles.matchedText, colDir]}>
            <Text style={[styles.matchedTitle, dirStyle]} numberOfLines={1}>
              {matched.title} · {b.priceEgp.replace('{price}', nf(Number(matched.price)))}
            </Text>
            <Text
              style={[
                styles.matchedSub,
                dirStyle,
                matched.budgetFit ? { color: FIT_COLOR[matched.budgetFit], fontFamily: fonts.extraBold } : null,
              ]}
              numberOfLines={1}
            >
              {matched.budgetFit
                ? fitText[matched.budgetFit]
                : matched.kind === 'saved' ? b.matchFromSaved : b.matchFromProducts}
            </Text>
          </View>
          <Pressable
            onPress={() => onMakeOffer(item, { kind: matched.kind, id: matched.id })}
            style={({ pressed }) => [styles.btn, styles.btnDk, styles.btnSm, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, styles.btnDkText]}>{b.sendIt}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.foot, rowDir]}>
        {item.isMine ? (
          <Text style={styles.footText}>{offers ?? b.offersCountNone}</Text>
        ) : canOffer ? (
          <>
            <Text
              style={[styles.footText, styles.footStrong, hot ? { color: isDark ? colors.y : '#8a5a00' } : null]}
              numberOfLines={1}
            >
              {hot ? b.offersCountNone : matched ? offers : b.noMatchProduct}
            </Text>
            {matched ? (
              <Pressable
                onPress={() => onMakeOffer(item)}
                style={({ pressed }) => [styles.btn, styles.btnOut, pressed && styles.pressed]}
              >
                <Text style={[styles.btnText, styles.btnOutText]}>{b.customOffer}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => onMakeOffer(item)}
                style={({ pressed }) => [styles.btn, styles.btnLg, hot ? styles.btnY : styles.btnDk, pressed && styles.pressed]}
              >
                <Text style={[styles.btnText, hot ? styles.btnYText : styles.btnDkText]}>
                  {item.myOffer ? b.makeOfferAgain : b.makeOffer}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={styles.footText}>{offers ?? b.offersCountNone}</Text>
            <View style={[styles.btn, styles.btnOut, styles.btnDisabled]}>
              <Text style={[styles.btnText, styles.btnOutText]}>{b.offerSent}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  card: {
    direction: 'ltr',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark ? colors.border : '#eaecf0',
    marginTop: 6,
    marginBottom: 14,
    ...(dark ? null : shadow.ss),
  },
  cardHot: { borderWidth: 1.5, borderColor: dark ? 'rgba(245,184,0,0.5)' : '#f6d77a' },
  cardSent: { borderColor: dark ? 'rgba(18,184,134,0.4)' : '#bfe9d4' },
  score: { position: 'absolute', top: -11, zIndex: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2 },
  scoreText: { fontFamily: fonts.black, fontSize: 11, color: '#fff' },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
  },
  ribbonStart: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  bolt: { width: 20, height: 20, borderRadius: 7, backgroundColor: colors.y, alignItems: 'center', justifyContent: 'center' },
  boltText: { fontSize: 11 },
  ribbonText: { fontFamily: fonts.black, fontSize: 12.5 },
  time: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.muted },
  head: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingTop: 14 },
  tile: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 28 },
  headText: { flex: 1, minWidth: 0 },
  meta: { fontFamily: fonts.extraBold, fontSize: 11.5, color: colors.subtle },
  title: { fontFamily: fonts.black, fontSize: 17, color: colors.heading, lineHeight: 24 },
  wants: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  want: {
    backgroundColor: dark ? colors.placeholder : colors.g100,
    borderWidth: 1,
    borderColor: dark ? colors.border : '#eaecf0',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  wantText: { fontFamily: fonts.extraBold, fontSize: 11.5, color: colors.text },
  budget: { marginHorizontal: 16, marginTop: 14, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  budgetSet: {
    backgroundColor: dark ? 'rgba(18,184,134,0.12)' : '#ecf9f2',
    borderColor: dark ? 'rgba(18,184,134,0.35)' : '#c8eed9',
  },
  budgetOpenBox: { backgroundColor: dark ? colors.placeholder : colors.g100, borderColor: dark ? colors.border : '#eaecf0' },
  budgetLabel: { fontFamily: fonts.extraBold, fontSize: 11.5, color: colors.muted },
  budgetLabelSet: { color: dark ? '#4ade80' : '#0f7a53' },
  budgetAmt: { fontFamily: fonts.black, fontSize: 21, color: dark ? '#6ee7b7' : '#065f46' },
  budgetCur: { fontFamily: fonts.extraBold, fontSize: 13 },
  budgetOpen: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.text },
  loc: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.muted, paddingHorizontal: 16, paddingTop: 10 },
  matched: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: dark ? 'rgba(122,154,240,0.5)' : '#b9c9f5',
    backgroundColor: dark ? 'rgba(41,82,204,0.12)' : '#f5f8ff',
  },
  matchedImg: { width: 38, height: 38, borderRadius: 10 },
  matchedPh: { alignItems: 'center', justifyContent: 'center' },
  matchedPhText: { fontSize: 18 },
  matchedText: { flex: 1, minWidth: 0 },
  matchedTitle: { fontFamily: fonts.black, fontSize: 12.5, color: colors.heading },
  matchedSub: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  footText: { flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 12.5, color: colors.muted },
  footStrong: { fontFamily: fonts.black },
  btn: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnSm: { paddingVertical: 7, paddingHorizontal: 12 },
  btnLg: { paddingVertical: 10, paddingHorizontal: 18 },
  btnY: { backgroundColor: colors.y },
  btnDk: { backgroundColor: dark ? colors.y : colors.dk },
  btnOut: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: dark ? colors.border : '#d0d5dd' },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontFamily: fonts.extraBold, fontSize: 13 },
  btnYText: { color: colors.dk },
  btnDkText: { color: dark ? colors.dk : '#fff' },
  btnOutText: { color: colors.heading },
  pressed: { opacity: 0.85 },
})

const themedStyles = { light: makeStyles(lightColors, false), dark: makeStyles(darkColors, true) }
