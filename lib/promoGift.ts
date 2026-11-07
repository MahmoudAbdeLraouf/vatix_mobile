import { authFetch, authPost } from '@/lib/auth'

export type PromoGiftLocale = 'ar' | 'en'

export interface PromoGiftOffer {
  enabled: boolean
  threshold: number
  days: number
  productCount: number
  eligible: boolean
  gotOfferGift: boolean
}

export interface PromotionGiftItem {
  id: number
  days: number
  source: 'three_products_offer' | 'admin'
  note: string | null
  expiresAt: string | null
  createdAt: string
  /** History items only. */
  claimedAt?: string | null
  claimedProductId?: number | null
  claimedPromotedUntil?: string | null
}

export interface PromoGiftsMe {
  offer: PromoGiftOffer | null
  gifts: PromotionGiftItem[]
  history: PromotionGiftItem[]
}

/** 1 → يوم, 2 → يومين, 3–10 → N أيام, 11+ → N يوم. English: 1 day / N days. */
export function formatGiftDays(n: number, locale: PromoGiftLocale): string {
  if (locale === 'en') return n === 1 ? '1 day' : `${n} days`
  if (n === 1) return 'يوم'
  if (n === 2) return 'يومين'
  if (n >= 3 && n <= 10) return `${n} أيام`
  return `${n} يوم`
}

/** Promotion end date in Cairo time, formatted for the current locale. */
export function formatPromotedUntil(iso: string, locale: PromoGiftLocale): string {
  const d = new Date(iso)
  try {
    return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Africa/Cairo',
    })
  } catch {
    return d.toLocaleDateString()
  }
}

export function getMyGifts(): Promise<PromoGiftsMe | null> {
  return authFetch<PromoGiftsMe>('/promotion-gifts/me')
}

export function claimGift(
  giftId: number,
  productId: number,
): Promise<{ productId: number; promotedUntil: string; title: string }> {
  return authPost(`/promotion-gifts/${giftId}/claim`, { productId })
}
