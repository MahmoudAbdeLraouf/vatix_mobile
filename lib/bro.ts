// Vatix Bro (buyer concierge) API client. Types mirror vatix_backend/src/bro.
// Dates arrive as ISO strings over JSON; MySQL decimals may arrive as strings.

import { apiFetch } from '@/lib/api'
import { authDelete, authFetch, authPost } from '@/lib/auth'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BroWant = 'cheaper' | 'better_condition' | 'with_box'
export type BroRequestSource = 'product' | 'product_sold' | 'search' | 'home' | 'nav'
export type BroRequestStatus = 'searching' | 'done' | 'expired' | 'cancelled'
export type BroInquiryStatus =
  | 'queued'
  | 'sent'
  | 'available'
  | 'sold'
  | 'free_text'
  | 'no_reply'
  | 'skipped'
export type BroScratches = 'none' | 'minor' | 'repaired'
export type BroStep = 'ask' | 'form' | 'thanks' | 'sold_confirm' | 'price_update'

/** A buyer's request (backend `BuyerRequest` entity). */
export interface BroRequest {
  id: number
  buyerId: number
  categoryId: number
  brandId: number | null
  modelText: string
  storage: string | null
  locationId: number | null
  budgetMin: number | string | null
  budgetMax: number | string | null
  wants: BroWant[]
  sourceProductId: number | null
  source: BroRequestSource
  status: BroRequestStatus
  platform: 'web' | 'mobile' | null
  appPlatform: 'web' | 'ios' | 'android' | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

/** A seller-confirmed match, as shown to the buyer. */
export interface BroMatchView {
  inquiryId: number
  product: {
    id: number
    title: string
    price: number
    image: string | null
    condition: string | null
    locationName: string | null
  }
  latestPrice: number | null
  priceDrop: number | null
  checkArea: string | null
  scratches: BroScratches | null
  hasBox: boolean | null
  hasInvoice: boolean | null
  hasWarranty: boolean | null
  warrantyNote: string | null
  sellerNote: string | null
  answeredAt: string
  isCheapest: boolean
  seller: {
    id: number
    displayName: string
    isStore: boolean
    logo: string | null
  }
}

export interface BroRequestView {
  request: BroRequest
  counts: { asked: number; available: number; sold: number; pending: number }
  matches: BroMatchView[]
  soldCount: number
}

/** What the seller answer page needs. Carries nothing about the buyer. */
export interface BroSellerView {
  inquiryId: number
  conversationId: number | null
  status: BroInquiryStatus
  area: string
  product: {
    id: number
    slug: string | null
    title: string
    price: number
    image: string | null
  } | null
  facts: {
    latestPrice: number | null
    checkArea: string | null
    scratches: BroScratches | null
    hasBox: boolean | null
    hasInvoice: boolean | null
    hasWarranty: boolean | null
    warrantyNote: string | null
    sellerNote: string | null
  }
  freeText: string | null
  answeredAt: string | null
}

/** Structured payload on Vatix Bro system chat messages (`Message.meta`). */
export interface BroMessageMeta {
  bro: { inquiryId: number; step: BroStep; actions: string[] }
}

export interface CreateBroRequestBody {
  categoryId: number
  brandId?: number
  modelText: string
  storage?: string
  locationId: number
  budgetMin?: number
  budgetMax?: number
  wants?: BroWant[]
  sourceProductId?: number
  source: BroRequestSource
}

export interface BroDetailsBody {
  latestPrice: number
  checkArea: string
  scratches: BroScratches
  hasBox: boolean
  hasInvoice: boolean
  hasWarranty: boolean
  warrantyNote?: string
  sellerNote?: string
}

export interface BroCreateResult {
  request: BroRequest
  candidateCount: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

/** Whether Bro entry points should be shown. Throws on failure (no fake "disabled"). */
export function getBroStatus(): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/bro/status')
}

/** Model autocomplete for a brand. */
export async function getModelSuggestions(brandId: number, q: string): Promise<string[]> {
  const params = new URLSearchParams({ brandId: String(brandId), q })
  return apiFetch<string[]>(`/bro/model-suggestions?${params}`)
}

// ─── Buyer (authenticated) ───────────────────────────────────────────────────

/** Throws an Error carrying the backend message (limits, Bro disabled, search down). */
export function createBroRequest(body: CreateBroRequestBody): Promise<BroCreateResult> {
  return authPost<BroCreateResult>('/bro/requests', body)
}

/** `null` means the call failed (not "no requests"). */
export function listBroRequests(): Promise<BroRequest[] | null> {
  return authFetch<BroRequest[]>('/bro/requests')
}

/** `null` means not found or the call failed. */
export function getBroRequest(id: number): Promise<BroRequestView | null> {
  return authFetch<BroRequestView>(`/bro/requests/${id}`)
}

export function cancelBroRequest(id: number): Promise<BroRequest> {
  return authPost<BroRequest>(`/bro/requests/${id}/cancel`, {})
}

export function rerunBroRequest(id: number): Promise<BroCreateResult> {
  return authPost<BroCreateResult>(`/bro/requests/${id}/rerun`, {})
}

/** Opens (or reuses) the buyer-seller chat for a confirmed match. */
export function connectBroInquiry(id: number): Promise<{ conversationId: number }> {
  return authPost<{ conversationId: number }>(`/bro/inquiries/${id}/connect`, {})
}

// ─── Seller (authenticated; ownership enforced server-side) ──────────────────

/** `null` means not found / not yours / the call failed. */
export function getBroSellerView(id: number): Promise<BroSellerView | null> {
  return authFetch<BroSellerView>(`/bro/inquiries/${id}/seller`)
}

export function answerBroAvailability(id: number, available: boolean): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/availability`, { available })
}

export function submitBroDetails(id: number, body: BroDetailsBody): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/details`, body)
}

export function submitBroFreeText(id: number, text: string): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/free-text`, { text })
}

/** Marks the listing sold (offline channel). */
export function broMarkSold(id: number): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/mark-sold`, {})
}

/** Sets the listing price to the price the seller just quoted. */
export function broUpdatePrice(id: number): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/update-price`, {})
}

/** Opt out of (true) or back into (false) Bro messages. Throws if the call fails. */
export async function setBroOptOut(optedOut: boolean): Promise<{ ok: boolean }> {
  if (optedOut) return authPost<{ ok: boolean }>('/bro/opt-out', {})
  const ok = await authDelete('/bro/opt-out')
  if (!ok) throw new Error('تعذّر تحديث الإعدادات')
  return { ok: true }
}
