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
}

// Backend labels are Arabic-only; English copy is keyed by reason code.
export const REASON_EN: Record<string, string> = {
  unclear_logo: 'The logo is unclear or does not belong to your store',
  generic_name: 'The store name is too generic or not allowed',
  not_electronics: 'Your business is not electronics-related',
  suspected_fake: 'The account details could not be trusted',
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
