// Vatix Bro (buyer concierge) API client. Types mirror vatix_backend/src/bro.
// Dates arrive as ISO strings over JSON; MySQL decimals may arrive as strings.

import { apiFetch, type VerificationCheck } from '@/lib/api'
import {
  authDelete,
  authFetch,
  authPatch,
  authPost,
  authRawRequest,
  authUploadForm,
  isLoggedIn,
} from '@/lib/auth'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BroWant = 'cheaper' | 'better_condition' | 'with_box'
export type BroRequestSource = 'product' | 'product_sold' | 'search' | 'home' | 'nav'
export type BroRequestStatus = 'searching' | 'done' | 'expired' | 'cancelled' | 'found'
export type BroInquiryStatus =
  | 'queued'
  | 'sent'
  | 'available'
  | 'sold'
  | 'wrong_model'
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
  /** When the request leaves the offers board (can outlive `expiresAt`). */
  boardExpiresAt: string
  /** Present on some responses only. */
  offerCount?: number
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
    /** Non-empty means the store is verified. */
    verificationChecks?: VerificationCheck[]
  }
}

export interface BroRequestView {
  request: BroRequest
  counts: { asked: number; available: number; sold: number; pending: number }
  matches: BroMatchView[]
  soldCount: number
  offers: BroOfferView[]
  offerCount: number
  boardExpiresAt: string
  onBoard: boolean
}

export type BroOfferSource = 'product' | 'scratch' | 'saved'

/** A seller offer as shown to the buyer (backend `BroOfferView`). */
export interface BroOfferView {
  offerId: number
  source: BroOfferSource
  title: string
  price: number
  image: string | null
  images: string[]
  locationName: string | null
  scratches: BroScratches | null
  hasBox: boolean
  hasInvoice: boolean
  hasWarranty: boolean
  warrantyNote: string | null
  sellerNote: string | null
  seller: {
    name: string
    type: 'client' | 'store'
    storeVerified?: boolean
    verificationChecks?: VerificationCheck[]
  }
  available: boolean
  /** Bro also confirmed this same seller + product: one card, not two. */
  viaBro: boolean
  createdAt: string
}

/** Content a seller offers; shared by saved offers and posted offers. */
export interface OfferContent {
  title: string
  price: number
  locationId?: number | null
  scratches?: BroScratches | null
  hasBox?: boolean
  hasInvoice?: boolean
  hasWarranty?: boolean
  warrantyNote?: string | null
  sellerNote?: string | null
  images?: string[]
  productId?: number | null
}

/** Stored offer status; `closed`/`unavailable` are derived (see `MyOfferState`). */
export type BroOfferStatus = 'active' | 'withdrawn'
export type MyOfferState = 'active' | 'closed' | 'unavailable' | 'withdrawn'

/** Backend `BroOffer` entity row. */
export interface BroOffer {
  id: number
  requestId: number
  sellerId: number
  source: BroOfferSource
  productId: number | null
  savedOfferId: number | null
  title: string
  price: number | string
  locationId: number | null
  scratches: BroScratches | null
  hasBox: boolean
  hasInvoice: boolean
  hasWarranty: boolean
  warrantyNote: string | null
  sellerNote: string | null
  images: string[]
  status: BroOfferStatus
  withdrawnAt: string | null
  buyerConnectedAt: string | null
  createdAt: string
  updatedAt: string
}

/** A seller's own offer with derived state and a slim request summary. */
export type MyOfferItem = Omit<BroOffer, 'request'> & {
  state: MyOfferState
  request: {
    id: number
    modelText: string
    storage: string | null
    locationName: string | null
  }
}

/** A seller's reusable offer template (`available` is false when its product is gone). */
export interface BroSavedOffer {
  id: number
  sellerId: number
  productId: number | null
  title: string
  price: number | string
  locationId: number | null
  scratches: BroScratches | null
  hasBox: boolean
  hasInvoice: boolean
  hasWarranty: boolean
  warrantyNote: string | null
  sellerNote: string | null
  images: string[]
  createdAt: string
  updatedAt: string
  available: boolean
}

/** A request on the public offers board (no buyer identity). */
export interface BroBoardItem {
  id: number
  modelText: string
  storage: string | null
  categoryName: string | null
  brandName: string | null
  locationName: string | null
  budgetMin: number | null
  budgetMax: number | null
  wants: BroWant[]
  offerCount: number
  /** Bro is still actively searching this request. */
  broSearching: boolean
  createdAt: string
  boardExpiresAt: string
  isMine: boolean
  myOffer: { id: number; status: BroOfferStatus } | null
}

/** True only for a live offer. A withdrawn offer does not block sending a new one. */
export function hasActiveOffer(item: Pick<BroBoardItem, 'myOffer'>): boolean {
  return !!item.myOffer && item.myOffer.status !== 'withdrawn'
}

/** Monthly offer usage. `cap` is null for stores (unlimited). */
export interface BroUsage {
  yearMonth: string
  /** ISO instant of the 1st of next month at 00:00 Cairo. */
  resetsAt: string
  offers: { used: number; cap: number | null }
}

export interface CreateBroOfferBody extends OfferContent {
  source: BroOfferSource
  savedOfferId?: number
  saveAsTemplate?: boolean
  /** Also list the offer as a product (only honoured when the offer has no product). */
  saveAsProduct?: boolean
}

/** The created offer plus the outcome of the optional save-as-product step. */
export interface CreateBroOfferResult extends BroOffer {
  productCreated?: boolean
  createdProductId?: number
  /** `cap`: the client hit the lifetime product cap; the offer was still sent. */
  productSkippedReason?: 'cap' | 'error'
  productCap?: number
  canUpgradeToStore?: boolean
}

export interface BroBoardQuery {
  categoryId?: number | null
  brandId?: number | null
  locationId?: number | null
  page?: number
  sort?: 'newest' | 'budget'
}

/** Error thrown by offer calls; carries the HTTP status and parsed body (e.g. cap details). */
export type BroApiError = Error & { status?: number; body?: Record<string, unknown> }

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

/** Buyer found a device elsewhere: ends the search (idempotent if already found). */
export function foundBroRequest(id: number): Promise<BroRequest> {
  return authPost<BroRequest>(`/bro/requests/${id}/found`, {})
}

/** Re-runs a search; optional overrides widen it (another area, no budget). */
export function rerunBroRequest(
  id: number,
  overrides?: { locationId?: number; clearBudget?: boolean },
): Promise<BroCreateResult> {
  return authPost<BroCreateResult>(`/bro/requests/${id}/rerun`, overrides ?? {})
}

/** Opens (or reuses) the buyer-seller chat for a confirmed match. */
export function connectBroInquiry(id: number): Promise<{ conversationId: number }> {
  return authPost<{ conversationId: number }>(`/bro/inquiries/${id}/connect`, {})
}

/** Opens (or reuses) the buyer-seller chat for a seller offer. */
export function connectBroOffer(id: number): Promise<{ conversationId: number }> {
  return authPost<{ conversationId: number }>(`/bro/offers/${id}/connect`, {})
}

// ─── Offers board ────────────────────────────────────────────────────────────

function broError(status: number, body: unknown, fallback: string): BroApiError {
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const raw = data.message
  const msg = Array.isArray(raw) ? raw.join('، ') : typeof raw === 'string' ? raw : fallback
  return Object.assign(new Error(msg), { status, body: data })
}

/** JSON call that keeps the HTTP status + body on failure (authPost drops them). */
async function broRaw<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await authRawRequest(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status < 200 || res.status >= 300) throw broError(res.status, res.body, 'Request failed')
  return res.body as T
}

/** Public board; signed-in callers also get `isMine` / `myOffer`. A 404 means Bro is off. */
export async function getBroBoard(
  q: BroBoardQuery = {},
): Promise<{ items: BroBoardItem[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams()
  if (q.categoryId != null) params.set('categoryId', String(q.categoryId))
  if (q.brandId != null) params.set('brandId', String(q.brandId))
  if (q.locationId != null) params.set('locationId', String(q.locationId))
  if (q.page != null) params.set('page', String(q.page))
  if (q.sort && q.sort !== 'newest') params.set('sort', q.sort)
  const qs = params.toString()
  const path = `/bro/board${qs ? `?${qs}` : ''}`
  type Page = { items: BroBoardItem[]; total: number; page: number; limit: number }
  if (await isLoggedIn()) {
    const res = await authFetch<Page>(path)
    if (!res) throw new Error('تعذّر تحميل الطلبات')
    return res
  }
  return apiFetch<Page>(path)
}

/** `null` means not found or the call failed. */
export function getBroBoardItem(id: number): Promise<BroBoardItem | null> {
  return authFetch<BroBoardItem>(`/bro/board/${id}`)
}

/** `null` means the call failed. */
export function getBroUsage(): Promise<BroUsage | null> {
  return authFetch<BroUsage>('/bro/usage')
}

/** Throws a `BroApiError`: 429 `BRO_CLIENT_OFFER_CAP` (body has cap/used/resetsAt), 409 `BRO_OFFER_EXISTS`. */
export function createBroOffer(requestId: number, body: CreateBroOfferBody): Promise<CreateBroOfferResult> {
  return broRaw<CreateBroOfferResult>(`/bro/board/${requestId}/offers`, 'POST', body)
}

export function withdrawBroOffer(id: number): Promise<BroOffer> {
  return authPost<BroOffer>(`/bro/offers/${id}/withdraw`, {})
}

/** `null` means the call failed. */
export function listMyBroOffers(page = 1): Promise<{ items: MyOfferItem[]; total: number } | null> {
  return authFetch<{ items: MyOfferItem[]; total: number }>(`/bro/my-offers?page=${page}`)
}

export interface PickedImage {
  uri: string
  mimeType?: string | null
  fileName?: string | null
}

/** Uploads up to 5 offer photos; returns their stored paths. */
export async function uploadBroOfferImages(images: PickedImage[]): Promise<string[]> {
  const form = new FormData()
  images.forEach((img, i) => {
    form.append('images', {
      uri: img.uri,
      name: img.fileName ?? `photo-${i}.jpg`,
      type: img.mimeType ?? 'image/jpeg',
    } as unknown as Blob)
  })
  const res = await authUploadForm('/bro/offer-images', form)
  if (res.status < 200 || res.status >= 300) throw broError(res.status, res.body, 'تعذّر رفع الصور')
  return res.body as string[]
}

// ─── Saved offers ────────────────────────────────────────────────────────────

/** `null` means the call failed. */
export function listSavedBroOffers(): Promise<BroSavedOffer[] | null> {
  return authFetch<BroSavedOffer[]>('/bro/saved-offers')
}

export function createSavedBroOffer(body: OfferContent): Promise<BroSavedOffer> {
  return authPost<BroSavedOffer>('/bro/saved-offers', body)
}

export function updateSavedBroOffer(id: number, body: Partial<OfferContent>): Promise<BroSavedOffer> {
  return authPatch<BroSavedOffer>(`/bro/saved-offers/${id}`, body)
}

export async function deleteSavedBroOffer(id: number): Promise<void> {
  const ok = await authDelete(`/bro/saved-offers/${id}`)
  if (!ok) throw new Error('تعذّر حذف العرض المحفوظ')
}

// ─── Seller (authenticated; ownership enforced server-side) ──────────────────

/** `null` means not found / not yours / the call failed. */
export function getBroSellerView(id: number): Promise<BroSellerView | null> {
  return authFetch<BroSellerView>(`/bro/inquiries/${id}/seller`)
}

export function answerBroAvailability(id: number, available: boolean): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/availability`, { available })
}

/** Seller says the listing is a different model than the one the buyer asked for. */
export function answerBroWrongModel(id: number): Promise<{ ok: boolean }> {
  return authPost<{ ok: boolean }>(`/bro/inquiries/${id}/wrong-model`, {})
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
