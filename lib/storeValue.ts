// Single source of truth for the store-subscription value pitch
// (mockups/store-upsell-system.html). Every upsell surface — UpgradeModal,
// register, cap-reached, banners, renew/expired, checkout, pricing — reads the
// same 6 items, numbers and copy helpers from here so nothing drifts.
import { useEffect, useState } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import { getSiteSettings, getSubscriptionPlans, type PlanData, type SiteSettings } from '@/lib/api'
import { TRIAL_DAYS } from '@/lib/trial'
import { formatGiftDays } from '@/lib/promoGift'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import type { Translations } from '@/lib/i18n'

/** List price shown struck through while the launch price is below it. */
export const LIST_PRICE = 600
/** Value of the product-promotion gift granted with every subscription payment. */
export const GIFT_VALUE = 200
/** Fallback monthly store price when plans haven't loaded. */
export const FALLBACK_STORE_PRICE = 450

export const STORE_DISPLAY_DOMAIN = 'vatix.store'

type IconName = keyof typeof Ionicons.glyphMap
type SvCopy = Translations['storeValue']
type SvKey = keyof SvCopy

export type StoreValueItemKey = 'products' | 'offers' | 'gift' | 'page' | 'verified' | 'analytics'

export interface StoreValueItem {
  key: StoreValueItemKey
  icon: IconName
  title: SvKey
  sub: SvKey
  subShort: SvKey
  chip: SvKey
  chipShort: SvKey
  /** Shows the ∞ badge on the icon. */
  infinity: boolean
  /** Rendered with the yellow "gift" treatment. */
  gift: boolean
}

export const STORE_VALUE_ITEMS: readonly StoreValueItem[] = [
  {
    key: 'products',
    icon: 'cube-outline',
    title: 'productsTitle',
    sub: 'productsSub',
    subShort: 'productsSub',
    chip: 'chipProducts',
    chipShort: 'chipProducts',
    infinity: true,
    gift: false,
  },
  {
    key: 'offers',
    icon: 'pricetag-outline',
    title: 'offersTitle',
    sub: 'offersSub',
    subShort: 'offersSubShort',
    chip: 'chipOffers',
    chipShort: 'chipOffers',
    infinity: true,
    gift: false,
  },
  {
    key: 'gift',
    icon: 'rocket-outline',
    title: 'giftTitle',
    sub: 'giftSub',
    subShort: 'giftSubShort',
    chip: 'chipGift',
    chipShort: 'chipGiftShort',
    infinity: false,
    gift: true,
  },
  {
    key: 'page',
    icon: 'storefront-outline',
    title: 'pageTitle',
    sub: 'pageTitle',
    subShort: 'pageTitle',
    chip: 'chipPage',
    chipShort: 'chipPage',
    infinity: false,
    gift: false,
  },
  {
    key: 'verified',
    icon: 'shield-checkmark-outline',
    title: 'verifiedTitle',
    sub: 'verifiedSub',
    subShort: 'verifiedSubShort',
    chip: 'chipVerified',
    chipShort: 'chipVerifiedShort',
    infinity: false,
    gift: false,
  },
  {
    key: 'analytics',
    icon: 'bar-chart-outline',
    title: 'analyticsTitle',
    sub: 'analyticsSub',
    subShort: 'analyticsSubShort',
    chip: 'chipAnalytics',
    chipShort: 'chipAnalyticsShort',
    infinity: false,
    gift: false,
  },
] as const

/** Items visible for the current params: offers needs Bro on, gift needs giftDays > 0. */
export function visibleStoreValueItems(p: { offersOn: boolean; giftDays: number }): StoreValueItem[] {
  return STORE_VALUE_ITEMS.filter(
    (i) => (i.key !== 'offers' || p.offersOn) && (i.key !== 'gift' || p.giftDays > 0),
  )
}

export function savingsPct(price: number, list: number = LIST_PRICE): number {
  if (!list) return 0
  return Math.round((1 - price / list) * 100)
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
export function toArDigits(input: string | number): string {
  return String(input)
    .split('')
    .map((c) => (/\d/.test(c) ? AR_DIGITS[Number(c)] : c))
    .join('')
}

/** Body-copy number: Arabic digits in ar, Latin grouping in en. */
export function fmt(n: number, locale: string): string {
  return locale === 'ar' ? toArDigits(n.toLocaleString('en-US')) : n.toLocaleString('en-US')
}

/** Price display (`.price-ui` in the mockup): Latin digits in both locales. */
export function fmtPrice(n: number): string {
  return n.toLocaleString('en-US')
}

/** Replaces `{key}` placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

export function storePriceFromPlans(plans: PlanData[]): number {
  const plan = plans.find((p) => p.storeType === 'store' && (p.billingCycle ?? 'monthly') === 'monthly')
  const n = Number(plan?.price ?? FALLBACK_STORE_PRICE)
  return Number.isFinite(n) && n > 0 ? n : FALLBACK_STORE_PRICE
}

export interface StoreValueParams {
  cap: number
  offers: number
  giftDays: number
  giftValue: number
  price: number
  list: number
  trialDays: number
  /** Bro offers enabled — controls the offers item. */
  offersOn: boolean
  loading: boolean
}

export function storeValueParamsFrom(
  settings: Partial<SiteSettings> | null | undefined,
  plans: PlanData[],
  offersOn: boolean,
  loading = false,
): StoreValueParams {
  return {
    cap: settings?.maxProductsPerClient ?? 10,
    offers: settings?.broClientOffersPerMonth ?? 10,
    giftDays: settings?.subscriptionGiftDays ?? 7,
    giftValue: GIFT_VALUE,
    price: storePriceFromPlans(plans),
    list: LIST_PRICE,
    trialDays: TRIAL_DAYS,
    offersOn,
    loading,
  }
}

/** Live numbers for the value pitch. Both fetches are cached app-wide. */
export function useStoreValueParams(): StoreValueParams {
  const offersOn = useBroEnabled()
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [plans, setPlans] = useState<PlanData[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    Promise.all([
      getSiteSettings().catch(() => null),
      getSubscriptionPlans().catch(() => [] as PlanData[]),
    ]).then(([st, p]) => {
      if (!alive) return
      setSettings(st)
      setPlans(p)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])
  return storeValueParamsFrom(settings, plans, offersOn, loading)
}

/**
 * Template vars for the storeValue copy. Body-copy numbers use Arabic digits in
 * ar; `giftDays` is the localized duration ("٧ أيام" / "7 days").
 */
export function storeValueVars(
  p: StoreValueParams,
  locale: string,
  extra: Record<string, string | number> = {},
): Record<string, string> {
  const ar = locale === 'ar'
  const d = (n: number) => fmt(n, locale)
  const gift = formatGiftDays(p.giftDays, ar ? 'ar' : 'en')
  const base: Record<string, string> = {
    cap: d(p.cap),
    offers: d(p.offers),
    giftDays: ar ? toArDigits(gift) : gift,
    giftValue: d(p.giftValue),
    price: d(p.price),
    list: d(p.list),
    trialDays: d(p.trialDays),
    pct: d(savingsPct(p.price, p.list)),
  }
  for (const [k, v] of Object.entries(extra)) base[k] = typeof v === 'number' ? d(v) : v
  return base
}

/** Fills one storeValue string with the live params. */
export function svText(
  copy: SvCopy,
  key: SvKey,
  p: StoreValueParams,
  locale: string,
  extra?: Record<string, string | number>,
): string {
  return fill(copy[key], storeValueVars(p, locale, extra))
}

// ── Store URL ────────────────────────────────────────────────────────────────

/** Port of the backend `normalizeArabic` used before slugifying store names. */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ٟ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim()
}

/** Port of the backend store-slug generator (preview only; the server decides the final slug). */
export function slugify(input: string): string {
  const s = normalizeArabic(input)
    .toLowerCase()
    .replace(/[^؀-ۿa-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return s || 'item'
}

/** Display form of a store URL: `vatix.store/<slug>` (never shows /s/ or /stores/). */
export function storeDisplayUrl(slug: string): string {
  return `${STORE_DISPLAY_DOMAIN}/${slug}`
}
