/**
 * Store sales record ("باع X منتج عبر فاتكس") — shared types and small pure helpers.
 * Types mirror the backend contracts (GET /stores/:id/sales-record and the optional
 * `salesRecord` payload field, which is absent when the feature flag is off).
 */

import { authFetch } from '@/lib/auth'
import type { Product } from '@/lib/api'

export type SaleVerificationStatus =
  | 'pending' | 'sent' | 'failed' | 'confirmed' | 'denied' | 'cancelled'

export interface SalesCounts {
  total: number
  verified: number
}

export interface PublicSalesRecord extends SalesCounts {
  recent: { productTitle: string; soldAt: string; verified: boolean }[]
}

/** Owner-only view (GET /stores/me/sales-record): public record plus sales awaiting buyer confirmation. */
export interface OwnSalesRecord extends PublicSalesRecord {
  pending: number
  denied: number
  notRequested: number
}

export type SalesTier = 'active' | 'trusted' | 'top'

/** Minimum total sales for each tier, lowest first. */
const TIERS: ReadonlyArray<{ tier: SalesTier; min: number }> = [
  { tier: 'active', min: 6 },
  { tier: 'trusted', min: 25 },
  { tier: 'top', min: 100 },
]

/** Tier reached for a given total (1-5 sales have no tier). */
export function salesTier(total: number): SalesTier | null {
  let reached: SalesTier | null = null
  for (const { tier, min } of TIERS) {
    if (total >= min) reached = tier
  }
  return reached
}

/**
 * Next tier above the current total and how many sales are left to reach it.
 * `label` is the tier key (map it with `t.salesRecord`); null once at the top tier.
 * `from` is the threshold of the band the total is in (0 below the first tier) and
 * `min` is the next tier's threshold, so progress = (total - from) / (min - from).
 */
export function nextTier(
  total: number,
): { label: SalesTier; remaining: number; from: number; min: number } | null {
  const idx = TIERS.findIndex(({ min }) => total < min)
  const next = idx === -1 ? null : TIERS[idx]
  return next
    ? { label: next.tier, remaining: next.min - total, from: idx > 0 ? TIERS[idx - 1].min : 0, min: next.min }
    : null
}

/** Egyptian mobile number (01[0125]xxxxxxxx) after stripping spaces. */
export function isValidBuyerPhone(s: string): boolean {
  return /^01[0125]\d{8}$/.test(s.replace(/\s+/g, ''))
}

/** Short relative date ("5 days ago" / "منذ 5 يوم") for an ISO timestamp. */
export function relativeSaleDate(iso: string, locale: 'ar' | 'en', now: number = Date.now()): string {
  const ms = now - new Date(iso).getTime()
  const ar = locale === 'ar'
  if (!Number.isFinite(ms) || ms < 60_000) return ar ? 'دلوقتي' : 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return ar ? `منذ ${mins} د` : `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return ar ? `منذ ${hours} س` : `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return ar ? `منذ ${days} يوم` : `${days} d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return ar ? `منذ ${months} شهر` : `${months} mo ago`
  const years = Math.max(1, Math.floor(days / 365))
  return ar ? `منذ ${years} سنة` : `${years} y ago`
}

/** Owner-only record. Throws AuthFetchError (404 when the sales-record flag is off). */
export async function getMySalesRecord(): Promise<OwnSalesRecord | null> {
  return authFetch<OwnSalesRecord>('/stores/me/sales-record')
}

/** Response of PATCH /products/:id/mark-sold: the product plus the new tally when a Vatix sale was recorded. */
export type MarkSoldResponse = Product & { salesRecord?: SalesCounts }

/**
 * Fills `{name}` placeholders by literal substitution (no regex replacement patterns),
 * so `$&`-style sequences in user-supplied values (store name, product title) are safe.
 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}

export interface SoldProductWords {
  productOne: string
  productFew: string
  productMany: string
}

/**
 * Fills a sold-count template (`{n}` + `{products}`), picking the noun by Arabic plural rules:
 * 1 → productOne, n % 100 in 3..10 → productFew, otherwise productMany.
 */
export function soldCountText(template: string, n: number, words: SoldProductWords): string {
  const mod100 = n % 100
  const word = n === 1 ? words.productOne : mod100 >= 3 && mod100 <= 10 ? words.productFew : words.productMany
  return fillTemplate(template, { n, products: word })
}
