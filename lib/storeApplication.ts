/**
 * Store application (signup → admin approval). Types mirror the backend
 * contract of GET /store-applications/me; see vatix_website/lib/api.ts.
 */

import { authFetch, authPost } from '@/lib/auth'

export type StoreApplicationStatus = 'pending' | 'needs_changes' | 'rejected' | 'approved'

export interface MyStoreApplication {
  status: StoreApplicationStatus
  storeName: string
  description: string | null
  locationId: number | null
  logo: string
  cover: string | null
  reasonCode: string | null
  /** Arabic label for reasonCode, ready to show. */
  reasonLabel: string | null
  adminNote: string | null
  resubmitCount: number
  submittedAt: string
  reviewedAt: string | null
  reviewSlaHours: number
  /** Live products right now; below `minProducts` the review waits on the merchant. */
  activeProductCount?: number
  minProducts?: number
}

// Backend labels are Arabic-only; English copy is keyed by reason code.
export const REASON_EN: Record<string, string> = {
  unclear_logo: 'The logo is unclear or does not belong to your store',
  generic_name: 'The store name is too generic or not allowed',
  not_electronics: 'Your business is not electronics-related',
  suspected_fake: 'The account details could not be trusted',
  individual_seller: 'Your account fits an individual seller rather than a store',
  no_products: 'You did not add any product within 24 hours of applying',
}

/** Null when the user never applied. */
export function getMyStoreApplication() {
  return authFetch<MyStoreApplication>('/store-applications/me')
}

/** Omitted logo/cover keep the current image. Allowed from any non-pending status. */
export function resubmitStoreApplication(body: {
  storeName: string
  description?: string
  locationId?: number
  logo?: string
  cover?: string
}) {
  return authPost<MyStoreApplication>('/store-applications/me/resubmit', body)
}

export type StoreNudgeTrigger = 'offer_cap' | 'product_cap' | 'offers' | 'products'

/** GET /store-applications/me/nudge. `offers` is null while Bro is off. Ignores the
 *  application itself — callers check `useMyStoreApplication()` before pitching. */
export interface StoreNudge {
  trigger: StoreNudgeTrigger | null
  products: { used: number; cap: number }
  offers: { used: number; cap: number } | null
}

export function getStoreNudge() {
  return authFetch<StoreNudge>('/store-applications/me/nudge')
}
