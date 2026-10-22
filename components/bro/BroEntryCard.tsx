import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { track } from '@/lib/analytics'
import { getBroStatus, type BroRequestSource, type BroWant } from '@/lib/bro'
import { BroAvatar, BroBadge } from '@/components/bro/BroAvatar'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

export type BroEntryVariant = 'product' | 'sold' | 'search' | 'home' | 'pill'

/** Plain prefill passed in by host screens. Empty values are dropped from the route params. */
export interface BroEntryContext {
  productId?: number | null
  categoryId?: number | null
  brandId?: number | null
  locationId?: number | null
  /** Product title or search text; truncated to 120 chars. */
  model?: string | null
  budgetMax?: number | string | null
  /** Listing price. Only used for the "cheaper than {price}" chip (also becomes budgetMax when toggled). */
  price?: number | null
}

const SOURCE: Record<BroEntryVariant, BroRequestSource> = {
  product: 'product',
  sold: 'product_sold',
  search: 'search',
  home: 'home',
  // Always-visible header pill on the products tab; prefilled from the current search/filters.
  pill: 'search',
}

const NAVY = colors.dk
const YELLOW = colors.y

/** Builds the /bro/new route params. Anything empty, zero or non-numeric-where-numeric is omitted. */
function buildBroNewParams(
  variant: BroEntryVariant,
  context: BroEntryContext,
  wants: BroWant[],
): Record<string, string> {
  const params: Record<string, string> = { source: SOURCE[variant] }
  const setId = (key: string, v: number | null | undefined) => {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) params[key] = String(v)
  }
  setId('productId', context.productId)
  setId('categoryId', context.categoryId)
  setId('brandId', context.brandId)
  setId('locationId', context.locationId)
  const model = (context.model ?? '').trim().slice(0, 120)
  if (model.length >= 2) params.model = model
  // Intake only accepts whole numbers, so round fractional prices up instead of dropping them.
  const budget = context.budgetMax == null ? NaN : Math.ceil(Number(context.budgetMax))
  if (Number.isSafeInteger(budget) && budget > 0) params.budgetMax = String(budget)
  if (wants.length) params.wants = wants.join(',')
  return params
}

const CHIPS: { want: BroWant; key: 'chipCheaper' | 'chipBetter' | 'chipBox' }[] = [
  { want: 'cheaper', key: 'chipCheaper' },
  { want: 'better_condition', key: 'chipBetter' },
  { want: 'with_box', key: 'chipBox' },
]

type Gate = 'loading' | 'on' | 'off'

// The card remounts often (e.g. FlatList empty component as results toggle), so share one
// status request across mounts. A rejection drops the cache so the next mount retries.
const STATUS_TTL_MS = 60_000
let statusCache: { promise: Promise<{ enabled: boolean }>; at: number } | null = null

function getCachedBroStatus(): Promise<{ enabled: boolean }> {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) return statusCache.promise
  const entry = { promise: getBroStatus(), at: Date.now() }
  statusCache = entry
  entry.promise.catch(() => {
    if (statusCache === entry) statusCache = null
  })
  return entry.promise
}

/** False until the cached status resolves; Bro entry points render nothing unless this is true. */
export function useBroEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let cancelled = false
    getCachedBroStatus()
      .then(s => {
        if (!cancelled) setEnabled(s.enabled)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return enabled
}

export function BroEntryCard({
  variant,
  context = {},
}: {
  variant: BroEntryVariant
  context?: BroEntryContext
}) {
  const { locale, t, isRtl } = useLocale()
  const b = t.bro
  const [gate, setGate] = useState<Gate>('loading')
  const [wants, setWants] = useState<BroWant[]>([])
  const tracked = useRef(false)

  // Never blocks or breaks the host screen: loading, disabled and failed all render nothing.
  useEffect(() => {
    let cancelled = false
    getCachedBroStatus()
      .then(s => {
        if (!cancelled) setGate(s.enabled ? 'on' : 'off')
      })
      .catch(() => {
        if (!cancelled) setGate('off')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The products-tab pill always shows, like "post free ad"; /bro/new handles the disabled state itself.
  const visible = variant === 'pill' || gate === 'on'

  // Once per mounted card, and only when it is actually visible.
  useEffect(() => {
    if (!visible || tracked.current) return
    tracked.current = true
    void track({ name: 'bro_entry_view', params: { variant } })
  }, [visible, variant])

  if (!visible) return null

  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const toggle = (w: BroWant) =>
    setWants(cur => (cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w]))

  const open = () => {
    // Only the "cheaper" chip carries the listing price along as the budget ceiling.
    const params = buildBroNewParams(
      variant,
      {
        ...context,
        budgetMax: wants.includes('cheaper') ? context.price ?? context.budgetMax : context.budgetMax,
      },
      wants,
    )
    router.push({ pathname: '/bro/new', params } as never)
  }

  if (variant === 'pill') {
    // Same height and shape as the yellow "post free ad" pill beside it, in navy so the two read as a pair.
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${b.navLink}: ${b.pillLabel}`}
        style={({ pressed }) => [styles.pill, rowDir, pressed && styles.pressed]}
      >
        <BroAvatar size={26} radius={13} />
        <Text style={styles.pillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {b.pillLabel}
        </Text>
        <Ionicons name="sparkles" size={12} color={YELLOW} />
      </Pressable>
    )
  }

  if (variant === 'home') {
    // Real Yoga direction (not the ltr + row-reverse trick) so the text column inherits RTL. The body is
    // placed by flex (alignSelf start, shrink-wrapped), not textAlign: Android flips an explicit
    // textAlign 'right' to the left edge for an Arabic paragraph.
    const bannerDir = { direction: ar ? ('rtl' as const) : ('ltr' as const) }
    const bannerTextDir = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
    // The whole banner is the tap target; the yellow arrow is just the affordance.
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${b.navLink}. ${b.heroStrip}`}
        style={({ pressed }) => [styles.banner, bannerDir, pressed && styles.pressed]}
      >
        <BroAvatar size={48} radius={14} />
        <View style={styles.bannerText}>
          <View style={styles.bannerTitleRow}>
            <Text style={[styles.bannerTitle, bannerTextDir]}>{b.navLink}</Text>
            <Ionicons name="sparkles" size={13} color={YELLOW} />
          </View>
          <Text style={[styles.bannerBody, bannerTextDir]} numberOfLines={2}>
            {b.heroStrip}
          </Text>
        </View>
        <View style={styles.bannerArrow}>
          <Ionicons name={ar ? 'arrow-back' : 'arrow-forward'} size={18} color={NAVY} />
        </View>
      </Pressable>
    )
  }

  const isSearch = variant === 'search'
  const isSold = variant === 'sold'
  const title = isSold ? b.soldTitle : isSearch ? b.searchEmptyTitle : b.name
  const modelLabel = (context.model ?? '').trim().slice(0, 40)
  const cta = isSold
    ? b.ctaFindAvailable
    : isSearch && modelLabel.length >= 2
      ? b.searchEmptyCta.replace('{model}', modelLabel)
      : b.ctaFind
  const priceLabel = context.price ? `${Number(context.price).toLocaleString()} ${t.egp}`.trim() : ''

  return (
    <View style={[styles.card, isSearch && styles.cardSearch]}>
      <View style={[styles.header, rowDir]}>
        <BroAvatar size={36} />
        <View style={styles.headerText}>
          <Text style={[isSold || isSearch ? styles.titleSm : styles.title, dirStyle]}>{title}</Text>
          {variant === 'product' && <BroBadge label={b.badge} />}
        </View>
      </View>

      {isSearch && <Text style={[styles.body, dirStyle]}>{b.searchEmptyBody}</Text>}

      {variant === 'product' && (
        <View style={[styles.chips, rowDir]}>
          {CHIPS.map(({ want, key }) => {
            const active = wants.includes(want)
            const label =
              want === 'cheaper' && !priceLabel
                ? b.chipCheaper.replace('{price}', '').trim()
                : b[key].replace('{price}', priceLabel)
            return (
              <Pressable
                key={want}
                onPress={() => toggle(want)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.chip, rowDir, active && styles.chipActive, pressed && styles.pressed]}
              >
                <Ionicons
                  name={active ? 'checkmark-circle' : 'add-circle-outline'}
                  size={15}
                  color={active ? YELLOW : 'rgba(255,255,255,0.6)'}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive, dirStyle]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
      )}

      <Pressable
        onPress={open}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, rowDir, pressed && styles.pressed]}
      >
        <Ionicons name="search" size={17} color={NAVY} />
        <Text style={[styles.ctaText, dirStyle]}>{cta}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  card: {
    backgroundColor: NAVY,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,184,0,0.35)',
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.ss,
  },
  cardSearch: { marginTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 24, color: colors.white },
  titleSm: { fontFamily: fonts.extraBold, fontSize: 14, lineHeight: 22, color: colors.white },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.white,
    opacity: 0.85,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.full,
    paddingStart: 10,
    paddingEnd: 14,
  },
  chipActive: { borderColor: YELLOW, backgroundColor: 'rgba(245,184,0,0.14)' },
  chipText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.white },
  chipTextActive: { fontFamily: fonts.bold, color: YELLOW },
  cta: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: YELLOW,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 14, color: NAVY, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: NAVY,
    borderRadius: radius.lg,
    paddingStart: 12,
    paddingEnd: 14,
    paddingVertical: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.ss,
  },
  bannerText: { flex: 1, minWidth: 0, gap: 2 },
  bannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bannerTitle: { fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 22, color: colors.white },
  bannerBody: {
    alignSelf: 'flex-start',
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.78)',
  },
  bannerArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingStart: 7,
    paddingEnd: 14,
    borderRadius: radius.full,
    backgroundColor: NAVY,
    ...shadow.ss,
  },
  pillText: { flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 13, color: colors.white },
})
