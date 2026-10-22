import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '@/contexts/locale'
import { hasActiveOffer, type BroBoardItem } from '@/lib/bro'
import { BroButton } from '@/components/bro/BroButton'
import { useBroCardFormat, useBroDir } from '@/components/bro/BroCardParts'
import { colors, fonts, radius, shadow } from '@/constants/theme'

/** Emoji + tint per category, matched on the localised category name (ar or en). */
const CATEGORY_ICONS: { re: RegExp; emoji: string; bg: string }[] = [
  { re: /موبايل|هاتف|تليفون|phone|mobile/i, emoji: '📱', bg: '#EEF4FF' },
  { re: /لابتوب|لاب توب|laptop|كمبيوتر|computer/i, emoji: '💻', bg: '#F1EEFF' },
  { re: /تابلت|ايباد|آيباد|tablet|ipad/i, emoji: '📲', bg: '#ECFDF5' },
  { re: /ساع|watch/i, emoji: '⌚', bg: '#FFF1F2' },
  { re: /سماع|اكسسوار|إكسسوار|headphone|accessor/i, emoji: '🎧', bg: '#FFF7ED' },
  { re: /العاب|ألعاب|بلايستيشن|console|gaming/i, emoji: '🎮', bg: '#F0F9FF' },
  { re: /كاميرا|camera/i, emoji: '📷', bg: '#F5F5F4' },
  { re: /شاش|تلفزيون|tv|monitor/i, emoji: '🖥️', bg: '#F1F5F9' },
]

function categoryIcon(name: string | null) {
  const hit = name ? CATEGORY_ICONS.find(c => c.re.test(name)) : undefined
  return hit ?? { emoji: '📦', bg: colors.g100 }
}

const FRESH_MS = 60 * 60 * 1000
const GREEN = '#16a34a'

/** One buy request on the offers board. */
export function BroBoardCard({ item, onMakeOffer }: { item: BroBoardItem; onMakeOffer: () => void }) {
  const { t, locale } = useLocale()
  const { dirStyle, rowDir } = useBroDir()
  const b = t.bro
  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')

  const now = Date.now()
  const { ago } = useBroCardFormat(now)
  const fresh = now - new Date(item.createdAt).getTime() < FRESH_MS
  const timeLabel = ago(item.createdAt)

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

  const storage = item.storage
    ? /^\d+$/.test(item.storage.trim())
      ? `${item.storage.trim()} ${b.storageUnit}`
      : item.storage
    : null
  const title = storage ? `${item.modelText} · ${storage}` : item.modelText
  const meta = [item.categoryName, item.brandName].filter(Boolean).join(' · ')

  const wantLabel = { cheaper: b.wantCheaper, better_condition: b.wantBetterCondition, with_box: b.wantWithBox }
  const wants = item.wants.length ? item.wants.map(w => wantLabel[w]) : [b.anyCondition]

  const canOffer = !item.isMine && !hasActiveOffer(item)
  const icon = categoryIcon(item.categoryName)

  return (
    <View style={styles.card}>
      <View style={[styles.top, rowDir]}>
        <View style={[styles.tile, { backgroundColor: icon.bg }]}>
          <Text style={styles.tileEmoji}>{icon.emoji}</Text>
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, dirStyle]} numberOfLines={2}>
            {title}
          </Text>
          {meta ? (
            <Text style={[styles.meta, dirStyle]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <View style={[styles.time, rowDir]}>
          {fresh ? <View style={styles.dot} /> : null}
          <Text style={[styles.timeText, fresh && { color: GREEN }]}>{timeLabel}</Text>
        </View>
      </View>

      <View style={[styles.budget, { backgroundColor: budget ? colors.yl : colors.g100 }]}>
        <Text style={[styles.budgetLabel, dirStyle]}>{b.budgetLabel}</Text>
        {budget ? (
          <Text style={[styles.budgetAmt, dirStyle]}>
            {budget} <Text style={styles.budgetCur}>{b.budgetCurrency}</Text>
          </Text>
        ) : (
          <Text style={[styles.budgetOpen, dirStyle]}>{b.budgetOpen}</Text>
        )}
      </View>

      <View style={[styles.pills, rowDir]}>
        {wants.map(w => (
          <View key={w} style={styles.pill}>
            <Text style={styles.pillText}>{w}</Text>
          </View>
        ))}
      </View>

      {item.locationName ? (
        <Text style={[styles.loc, dirStyle]}>📍 {b.cardInArea.replace('{area}', item.locationName)}</Text>
      ) : null}

      {!item.isMine ? (
        <View style={styles.action}>
          {canOffer ? (
            <BroButton
              label={item.myOffer ? b.makeOfferAgain : b.makeOffer}
              onPress={onMakeOffer}
              variant="yellow"
              size="md"
              fullWidth
            />
          ) : (
            <BroButton label={b.offerSent} onPress={() => {}} disabled size="md" fullWidth icon="checkmark" />
          )}
        </View>
      ) : null}

      {item.offerCount > 0 ? (
        <Text style={[styles.count, dirStyle]}>
          {item.offerCount === 1 ? b.offersCountOne : b.offersCount.replace('{n}', String(item.offerCount))}
        </Text>
      ) : canOffer ? (
        <Text style={[styles.count, styles.firstHint, dirStyle]}>{b.firstOfferHint}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g100,
    padding: 14,
    marginBottom: 12,
    gap: 10,
    ...shadow.ss,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tile: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 22 },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.dk, lineHeight: 22 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.g500 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  timeText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.g500 },
  budget: { borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  budgetLabel: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.g600 },
  budgetAmt: { fontFamily: fonts.black, fontSize: 19, color: colors.dk },
  budgetCur: { fontFamily: fonts.bold, fontSize: 13, color: colors.g700 },
  budgetOpen: { fontFamily: fonts.bold, fontSize: 15, color: colors.g700 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    backgroundColor: colors.g50,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.g700 },
  loc: { fontFamily: fonts.regular, fontSize: 12, color: colors.g600 },
  action: { marginTop: 2 },
  count: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.g600, textAlign: 'center' },
  firstHint: { color: '#c2410c' },
})
