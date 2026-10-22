import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { track } from '@/lib/analytics'
import { getBroStatus, type BroRequestSource, type BroWant } from '@/lib/bro'
import { BroAvatar, BroBadge } from '@/components/bro/BroAvatar'
import { colors, fonts, radius, spacing } from '@/constants/theme'

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

const NAVY = '#1A2540'
const YELLOW = '#F5B800'
const LIGHT = '#fff8e1'

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

  // Once per mounted card, and only when it is actually visible.
  useEffect(() => {
    if (gate !== 'on' || tracked.current) return
    tracked.current = true
    void track({ name: 'bro_entry_view', params: { variant } })
  }, [gate, variant])

  if (gate !== 'on') return null

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
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={b.navLink}
        style={[styles.pill, rowDir]}
      >
        <BroAvatar size={20} />
        <Text style={styles.pillText}>{b.navLink}</Text>
      </TouchableOpacity>
    )
  }

  if (variant === 'home') {
    return (
      <View style={[styles.strip, rowDir]}>
        <BroAvatar size={32} />
        <Text style={[styles.stripText, dirStyle]}>{b.heroStrip}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={b.navLink}
          style={[styles.stripBtn, rowDir]}
        >
          <Text style={styles.stripBtnText}>{b.navLink}</Text>
          <Ionicons name={ar ? 'arrow-back' : 'arrow-forward'} size={14} color={colors.white} />
        </TouchableOpacity>
      </View>
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
              <TouchableOpacity
                key={want}
                activeOpacity={0.8}
                onPress={() => toggle(want)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive, dirStyle]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={open}
        accessibilityRole="button"
        style={styles.cta}
      >
        <Text style={[styles.ctaText, dirStyle]}>{cta}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NAVY,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: YELLOW,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { borderColor: YELLOW, backgroundColor: 'rgba(245,184,0,0.12)' },
  chipText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.white },
  chipTextActive: { color: YELLOW },
  cta: {
    backgroundColor: YELLOW,
    borderRadius: radius.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.extraBold, fontSize: 14, color: NAVY, textAlign: 'center' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: YELLOW,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    marginTop: spacing.lg,
  },
  stripText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: NAVY },
  stripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: NAVY,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stripBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingStart: 6,
    paddingEnd: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: NAVY,
    borderWidth: 1.5,
    borderColor: YELLOW,
  },
  pillText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.white },
})
