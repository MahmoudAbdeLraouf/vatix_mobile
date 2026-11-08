// The store-subscription value block (mockups/store-upsell-system.html §0).
// One component, same 6 items in the same order everywhere — only the density
// changes: full (vertical equation), compact (chips + price line), receipt
// (pay step) and loss (renew / downgrade).
import React, { useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fonts, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { PAID_UI_ENABLED } from '@/lib/platform'
import { VerifiedSeal } from '@/components/VerifiedBadge'
import {
  fmtPrice,
  storeDisplayUrl,
  svText,
  useStoreValueParams,
  visibleStoreValueItems,
  STORE_DISPLAY_DOMAIN,
  type StoreValueItem,
  type StoreValueItemKey,
  type StoreValueParams,
} from '@/lib/storeValue'

const LRI = '⁦'
const PDI = '⁩'
/** Placeholder slug shown before the user has a store. */
export const PLACEHOLDER_SLUG = 'yourstore'

function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const } : null,
    colDir: ar ? { direction: 'rtl' as const } : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
  }
}

/** Live params unless the host already loaded them. */
function useParams(params?: StoreValueParams): StoreValueParams {
  const live = useStoreValueParams()
  return params ?? live
}

// ── URL ──────────────────────────────────────────────────────────────────────

/**
 * Inline store URL: `vatix.store/<slug>`, always LTR, slug in yd. Nest it inside
 * a <Text>; the isolate marks keep it LTR inside Arabic sentences.
 */
export function StoreUrl({ slug, style }: { slug?: string | null; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme()
  const s = slug || PLACEHOLDER_SLUG
  return (
    <Text style={[{ fontFamily: fonts.extraBold, writingDirection: 'ltr' }, style]}>
      {LRI}
      {STORE_DISPLAY_DOMAIN}/<Text style={{ color: colors.yd }}>{s}</Text>
      {PDI}
    </Text>
  )
}

/** Plain-string form for share sheets / accessibility. */
export function storeUrlText(slug?: string | null): string {
  return storeDisplayUrl(slug || PLACEHOLDER_SLUG)
}

/** Renders a filled template that still contains `{url}` with an inline StoreUrl. */
export function UrlText({
  text,
  slug,
  style,
  numberOfLines,
}: {
  text: string
  slug?: string | null
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  const parts = text.split('{url}')
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <StoreUrl slug={slug} /> : null}
        </React.Fragment>
      ))}
    </Text>
  )
}

// ── Chips ────────────────────────────────────────────────────────────────────

export function StoreValueChips({
  params,
  short = false,
  giftFull = false,
  onDark = false,
  order,
  style,
}: {
  params?: StoreValueParams
  /** Item keys in display order (unlisted items are dropped). Defaults to the canonical order. */
  order?: readonly StoreValueItemKey[]
  /** Short labels (chipShort keys). */
  short?: boolean
  /** Keep the full gift label even when `short`. */
  giftFull?: boolean
  /** Translucent chips for dark (navy) surfaces such as banners. */
  onDark?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const p = useParams(params)
  const visible = visibleStoreValueItems(p)
  const items = order
    ? order.flatMap((k) => visible.filter((it) => it.key === k))
    : visible
  return (
    <View style={[styles.chips, rowDir, style]}>
      {items.map((it) => {
        const key = short && !(it.gift && giftFull) ? it.chipShort : it.chip
        const gift = it.gift
        return (
          <View
            key={it.key}
            style={[
              styles.chip,
              rowDir,
              onDark && styles.chipDark,
              gift && (onDark ? styles.chipGiftDark : styles.chipGift),
            ]}
          >
            <Ionicons
              name={it.icon}
              size={14}
              color={onDark ? colors.y : gift ? colors.yd : colors.yd}
            />
            <Text
              style={[
                styles.chipText,
                dirStyle,
                onDark && { color: colors.white },
                gift && { color: onDark ? colors.y : colors.yellowText },
              ]}
              numberOfLines={1}
            >
              {svText(t.storeValue, key, p, locale)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Price blocks ─────────────────────────────────────────────────────────────

/** Compact price line: `= 450 ج.م/شهر ~600~` + trial pill (price hidden on iOS). */
export function StoreValuePriceLine({
  params,
  onDark = false,
  showTrial = true,
  style,
}: {
  params?: StoreValueParams
  onDark?: boolean
  showTrial?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const p = useParams(params)
  const sv = t.storeValue
  const main = onDark ? colors.white : colors.heading
  const dim = onDark ? 'rgba(255,255,255,0.45)' : colors.subtle
  return (
    <View style={[styles.priceLine, rowDir, style]}>
      {PAID_UI_ENABLED ? (
        <Text style={[styles.plText, { color: main }, dirStyle]}>
          {'= '}
          <Text style={styles.plBig}>{fmtPrice(p.price)}</Text> {sv.perMonthShort}
          {p.list > p.price ? (
            <>
              {' '}
              <Text style={[styles.strike, { color: dim }]}>{fmtPrice(p.list)}</Text>
            </>
          ) : null}
        </Text>
      ) : (
        <Text style={[styles.plText, { color: main }, dirStyle]}>= {sv.iosStoreSub}</Text>
      )}
      {showTrial && p.trialDays > 0 ? (
        <View style={styles.trialPill}>
          <Text style={[styles.trialPillText, dirStyle]}>{svText(sv, 'trialFirst', p, locale)}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** The navy "= 450 ج.م / شهر" result box under the full equation. */
export function StoreValueResult({
  params,
  style,
}: {
  params?: StoreValueParams
  style?: StyleProp<ViewStyle>
}) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, colDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const p = useParams(params)
  const sv = t.storeValue
  const pct = p.list > p.price ? Math.round((1 - p.price / p.list) * 100) : 0
  return (
    <View style={[styles.eqres, style]}>
      <View style={[styles.eqresTop, rowDir]}>
        <Text style={styles.eqs}>=</Text>
        {PAID_UI_ENABLED ? (
          <>
            <View style={[styles.eqPrice, rowDir]}>
              <Text style={styles.eqPriceBig}>{fmtPrice(p.price)}</Text>
              <Text style={[styles.eqPer, dirStyle]}>{sv.perMonth}</Text>
              {pct > 0 ? <Text style={styles.eqStrike}>{fmtPrice(p.list)}</Text> : null}
            </View>
            {pct > 0 ? (
              <View style={styles.offPill}>
                <Text style={[styles.offText, dirStyle]}>{svText(sv, 'savePct', p, locale)}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.eqIos, dirStyle]}>{sv.iosOneSub}</Text>
        )}
      </View>
      {p.trialDays > 0 ? (
        <View style={[styles.eqTrial, colDir]}>
          <Text style={[styles.eqTrialText, dirStyle]}>{svText(sv, 'trialFirst', p, locale)}</Text>
          <Text style={[styles.eqTrialSub, dirStyle]}>{sv.trialNoPay}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ── Main block ───────────────────────────────────────────────────────────────

export type StoreValueVariant = 'full' | 'compact' | 'receipt' | 'loss'

interface StoreValueProps {
  variant: StoreValueVariant
  params?: StoreValueParams
  /** Store slug for the page item / URL rows; placeholder when absent. */
  slug?: string | null
  style?: StyleProp<ViewStyle>

  // full
  /** Show the "باقة المتجر" ribbon + title (default true). Off = modal embed (1.5px border). */
  header?: boolean
  /** Override the h3 title. */
  title?: string
  /** Use the shorter item subtitles. */
  short?: boolean
  /** Show the navy price/trial result box (default true). */
  showResult?: boolean

  // compact
  shortChips?: boolean
  showPrice?: boolean

  // receipt
  /** Total row note (default totalNoteMonth). */
  totalNote?: string
  /** Store-provided price label (StoreKit displayPrice) — replaces the EGP total. */
  priceLabel?: string | null
  /** Override the charged amount (EGP). */
  amount?: number
  /** Show the "after paying you pick the product" line (default when gift is on). */
  showNow?: boolean
  /** Show the total row at all (default true). */
  showTotal?: boolean

  // loss
  /** 'expire' (lossTitle, with gift row) or 'downgrade' (convLose rows). */
  lossKind?: 'expire' | 'downgrade'
  /** Listings that get deactivated on downgrade. */
  count?: number
}

export function StoreValue(props: StoreValueProps) {
  const p = useParams(props.params)
  switch (props.variant) {
    case 'compact':
      return <Compact {...props} p={p} />
    case 'receipt':
      return <Receipt {...props} p={p} />
    case 'loss':
      return <Loss {...props} p={p} />
    default:
      return <Full {...props} p={p} />
  }
}

type Inner = StoreValueProps & { p: StoreValueParams }

function Full({ p, slug, style, header = true, title, short = false, showResult = true }: Inner) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const sv = t.storeValue
  const items = visibleStoreValueItems(p)

  const renderSub = (it: StoreValueItem) => {
    if (it.key === 'page') {
      return (
        <Text style={[styles.rowSub, dirStyle]} numberOfLines={1}>
          <StoreUrl slug={slug} />
        </Text>
      )
    }
    return (
      <Text style={[styles.rowSub, dirStyle]}>{svText(sv, short ? it.subShort : it.sub, p, locale)}</Text>
    )
  }

  return (
    <View style={[styles.full, !header && styles.fullPlain, style]}>
      {header ? (
        <>
          <View style={[styles.ribbon, ar ? { right: 18 } : { left: 18 }]}>
            <Text style={styles.ribbonText}>{sv.ribbon}</Text>
          </View>
          <Text style={[styles.fullTitle, dirStyle]}>{title ?? sv.fullTitle}</Text>
        </>
      ) : title ? (
        <Text style={[styles.fullTitle, dirStyle]}>{title}</Text>
      ) : null}

      <View style={[styles.eq, (header || title) && { marginTop: 12 }]}>
        {items.map((it, i) => (
          <View
            key={it.key}
            style={[
              styles.eqRow,
              rowDir,
              it.gift && styles.eqRowGift,
              i === items.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            {i > 0 ? (
              <View style={styles.plus}>
                <Text style={styles.plusText}>+</Text>
              </View>
            ) : null}
            <View style={[styles.icBox, it.gift && styles.icBoxGift]}>
              <Ionicons name={it.icon} size={18} color={it.gift ? colors.dk : colors.y} />
              {it.infinity ? (
                <View style={[styles.inf, ar ? { left: -6 } : { right: -6 }]}>
                  <Text style={styles.infText}>∞</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.tx, colDir]}>
              <View style={[styles.titleRow, rowDir]}>
                <Text style={[styles.rowTitle, dirStyle]}>{svText(sv, it.title, p, locale)}</Text>
                {it.key === 'verified' ? <VerifiedSeal size={15} /> : null}
              </View>
              {renderSub(it)}
            </View>
          </View>
        ))}
      </View>

      {showResult ? <StoreValueResult params={p} style={{ marginTop: 12 }} /> : null}
    </View>
  )
}

function Compact({ p, style, shortChips = false, showPrice = true }: Inner) {
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  return (
    <View style={[styles.compact, style]}>
      <StoreValueChips params={p} short={shortChips} />
      {showPrice ? <StoreValuePriceLine params={p} style={{ marginTop: 10 }} /> : null}
    </View>
  )
}

function Receipt({
  p,
  slug,
  style,
  totalNote,
  priceLabel,
  amount,
  showNow,
  showTotal = true,
}: Inner) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, colDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const sv = t.storeValue
  const s = (k: Parameters<typeof svText>[1]) => svText(sv, k, p, locale)
  const price = amount ?? p.price

  type Row = { key: string; label: React.ReactNode; value: string; gift?: boolean; seal?: boolean }
  const rows: Row[] = [
    { key: 'products', label: s('productsTitle'), value: s('rcProductsVal') },
  ]
  if (p.offersOn) rows.push({ key: 'offers', label: s('offersTitle'), value: s('rcOffersVal') })
  if (p.giftDays > 0) rows.push({ key: 'gift', label: s('rcGift'), value: s('rcGiftVal'), gift: true })
  rows.push({
    key: 'page',
    label: <UrlText text={s('rcPage')} slug={slug} style={[styles.rcLabel, dirStyle]} numberOfLines={1} />,
    value: sv.rcIncluded,
  })
  rows.push({ key: 'verified', label: s('verifiedTitle'), value: sv.rcFree, seal: true })
  rows.push({ key: 'analytics', label: s('analyticsTitle'), value: sv.rcIncluded })

  const showPriceTotal = showTotal && (PAID_UI_ENABLED || !!priceLabel)
  const now = showNow ?? p.giftDays > 0

  return (
    <View style={[styles.rc, style]}>
      <Text style={[styles.rcTitle, dirStyle]}>{sv.receiptTitle}</Text>
      {rows.map((r, i) => (
        <View
          key={r.key}
          style={[styles.rcRow, rowDir, i === rows.length - 1 && { borderBottomWidth: 0 }]}
        >
          <Ionicons name="checkmark" size={17} color={colors.green} />
          <View style={[styles.rcLabelWrap, rowDir]}>
            {typeof r.label === 'string' ? (
              <Text style={[styles.rcLabel, dirStyle]} numberOfLines={1}>
                {r.label}
              </Text>
            ) : (
              r.label
            )}
            {r.seal ? <VerifiedSeal size={14} /> : null}
          </View>
          <View style={r.gift ? styles.gvPill : null}>
            <Text style={[styles.rcVal, r.gift && styles.gvText, dirStyle]}>{r.value}</Text>
          </View>
        </View>
      ))}
      {showPriceTotal ? (
        <View style={[styles.tot, rowDir]}>
          <View style={[styles.totLeft, colDir]}>
            <Text style={[styles.totLabel, dirStyle]}>{sv.total}</Text>
            <Text style={[styles.totNote, dirStyle]}>{totalNote ?? sv.totalNoteMonth}</Text>
          </View>
          {priceLabel ? (
            <Text style={styles.totBig}>{priceLabel}</Text>
          ) : (
            <Text style={[styles.totPrice, dirStyle]}>
              {p.list > price ? (
                <>
                  <Text style={styles.totStrike}>{fmtPrice(p.list)}</Text>{' '}
                </>
              ) : null}
              <Text style={styles.totBig}>{fmtPrice(price)}</Text> {sv.currency}
            </Text>
          )}
        </View>
      ) : null}
      {now ? (
        <View style={styles.now}>
          <Text style={[styles.nowText, dirStyle]}>{s('receiptNow')}</Text>
        </View>
      ) : null}
    </View>
  )
}

function Loss({ p, slug, style, lossKind = 'expire', count = 0, title }: Inner) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const sv = t.storeValue
  const s = (k: Parameters<typeof svText>[1]) => svText(sv, k, p, locale, { count })

  type Row = { key: string; text: string; url?: boolean; seal?: boolean; gift?: boolean }
  const rows: Row[] =
    lossKind === 'downgrade'
      ? [
          ...(count > 0 ? [{ key: 'products', text: s('convListings') }] : []),
          ...(p.offersOn ? [{ key: 'offers', text: s('convOffers') }] : []),
          { key: 'page', text: s('convPage'), url: true },
          { key: 'verified', text: s('convVerified'), seal: true },
          { key: 'analytics', text: s('convAnalytics') },
        ]
      : [
          { key: 'products', text: s('lossProducts') },
          ...(p.offersOn ? [{ key: 'offers', text: s('lossOffers') }] : []),
          { key: 'page', text: s('lossPage'), url: true },
          { key: 'verified', text: s('lossVerified'), seal: true },
          { key: 'analytics', text: s('lossAnalytics') },
          ...(p.giftDays > 0 ? [{ key: 'gift', text: s('lossGift'), gift: true }] : []),
        ]

  return (
    <View style={[styles.ls, style]}>
      <Text style={[styles.lsTitle, dirStyle]}>
        {title ?? (lossKind === 'downgrade' ? sv.convLose : sv.lossTitle)}
      </Text>
      {rows.map((r) => (
        <View key={r.key} style={[styles.lsRow, rowDir]}>
          <Ionicons
            name={r.gift ? 'gift-outline' : 'close'}
            size={17}
            color={r.gift ? colors.yd : colors.red}
          />
          <View style={[styles.rcLabelWrap, rowDir]}>
            {r.url ? (
              <UrlText text={r.text} slug={slug} style={[styles.lsText, dirStyle]} />
            ) : (
              <Text style={[styles.lsText, r.gift && { color: colors.yellowText }, dirStyle]}>{r.text}</Text>
            )}
            {r.seal ? <VerifiedSeal size={14} /> : null}
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

export function makeStyles(c: ThemeColors, isDark: boolean) {
  const icBg = isDark ? c.dk3 : c.dk
  const body = isDark ? c.text : c.g700
  const pill = isDark ? c.pressed : c.g100
  return StyleSheet.create({
    // full
    full: {
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.y,
      borderRadius: 22,
      padding: 16,
      paddingTop: 20,
    },
    fullPlain: { borderWidth: 1.5, paddingTop: 14 },
    ribbon: {
      position: 'absolute',
      top: -13,
      backgroundColor: c.y,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 3,
    },
    ribbonText: { fontFamily: fonts.black, fontSize: 11.5, color: c.dk },
    fullTitle: { fontFamily: fonts.black, fontSize: 19, color: c.heading, lineHeight: 27 },
    eq: { borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden' },
    eqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 10,
      paddingHorizontal: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.card,
    },
    eqRowGift: { backgroundColor: c.yellowBg },
    plus: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusText: { fontFamily: fonts.black, fontSize: 14, color: c.muted, lineHeight: 18 },
    icBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: icBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icBoxGift: { backgroundColor: c.y },
    inf: {
      position: 'absolute',
      bottom: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.y,
      borderWidth: 2,
      borderColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infText: { fontFamily: fonts.black, fontSize: 11, color: c.dk, lineHeight: 14 },
    tx: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowTitle: { fontFamily: fonts.black, fontSize: 13.5, color: c.heading, lineHeight: 19 },
    rowSub: { fontFamily: fonts.bold, fontSize: 11, color: c.muted, lineHeight: 16 },

    // eqres
    eqres: {
      backgroundColor: c.hero,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    eqresTop: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    eqs: { fontFamily: fonts.black, fontSize: 26, color: c.y, lineHeight: 32 },
    eqPrice: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    eqPriceBig: { fontFamily: fonts.black, fontSize: 30, color: c.white, lineHeight: 38 },
    eqPer: { fontFamily: fonts.extraBold, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    eqStrike: {
      fontFamily: fonts.bold,
      fontSize: 16,
      color: 'rgba(255,255,255,0.45)',
      textDecorationLine: 'line-through',
    },
    eqIos: { fontFamily: fonts.black, fontSize: 18, color: c.white },
    offPill: { backgroundColor: c.y, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
    offText: { fontFamily: fonts.black, fontSize: 11, color: c.dk },
    eqTrial: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.15)',
    },
    eqTrialText: { fontFamily: fonts.extraBold, fontSize: 13, color: c.y },
    eqTrialSub: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },

    // compact
    compact: {
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderColor: 'rgba(245,184,0,0.6)',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: pill,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 30,
      paddingVertical: 3,
      paddingHorizontal: 9,
    },
    chipDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
    chipGift: { backgroundColor: c.yellowBg, borderColor: 'rgba(245,184,0,0.5)' },
    chipGiftDark: { backgroundColor: 'rgba(245,184,0,0.18)', borderColor: 'rgba(245,184,0,0.4)' },
    chipText: { fontFamily: fonts.extraBold, fontSize: 12, color: c.heading },
    priceLine: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    plText: { fontFamily: fonts.black, fontSize: 14 },
    plBig: { fontSize: 20 },
    strike: { textDecorationLine: 'line-through', fontFamily: fonts.bold },
    trialPill: { backgroundColor: c.greenBg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
    trialPillText: { fontFamily: fonts.extraBold, fontSize: 12, color: c.green },

    // receipt
    rc: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    rcTitle: { fontFamily: fonts.black, fontSize: 14, color: c.heading, marginBottom: 6 },
    rcRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderStyle: 'dashed',
      borderBottomColor: c.border,
    },
    rcLabelWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
    rcLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: body, flexShrink: 1 },
    rcVal: { fontFamily: fonts.extraBold, fontSize: 12.5, color: c.muted },
    gvPill: { backgroundColor: c.yellowBg, borderRadius: 20, paddingHorizontal: 8 },
    gvText: { color: c.yellowText },
    tot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingTop: 10,
      gap: 8,
    },
    totLeft: { flexShrink: 1 },
    totLabel: { fontFamily: fonts.black, fontSize: 14, color: c.heading },
    totNote: { fontFamily: fonts.bold, fontSize: 11.5, color: c.muted },
    totPrice: { fontFamily: fonts.black, fontSize: 14, color: c.heading },
    totStrike: { fontSize: 14, color: c.subtle, textDecorationLine: 'line-through', fontFamily: fonts.bold },
    totBig: { fontFamily: fonts.black, fontSize: 22, color: c.price },
    now: {
      marginTop: 8,
      backgroundColor: c.greenBg,
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    nowText: {
      fontFamily: fonts.extraBold,
      fontSize: 12.5,
      color: isDark ? c.green : '#0b7a57',
      textAlign: 'center',
    },

    // loss
    ls: {
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(229,62,62,0.35)' : '#ffd8d8',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    lsTitle: { fontFamily: fonts.black, fontSize: 14, color: c.red, marginBottom: 6 },
    lsRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
    lsText: { fontFamily: fonts.bold, fontSize: 13.5, color: body, flexShrink: 1 },
  })
}
