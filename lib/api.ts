import { AUTH_ERR } from '@/lib/auth'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'
const MINIO_PUBLIC = process.env.EXPO_PUBLIC_MINIO_URL ?? 'http://localhost:9000'

// eslint-disable-next-line no-console
console.log('[api] BASE=', BASE, 'MINIO=', MINIO_PUBLIC)

// When `opts.w` is passed we route through the backend's on-the-fly resize
// endpoint (`/image?src=…&w=…`) so grid cells fetch ~400px thumbs instead of
// the original multi-MB upload — huge win for FlatList scroll perf on mobile.
export function imgUrl(
  url: string | null | undefined,
  opts?: { w?: number },
): string | null {
  if (!url) return null
  const path = url.startsWith('http') ? url.replace(/^https?:\/\/[^/]+/, '') : url
  const direct = `${MINIO_PUBLIC.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  if (!opts?.w) return direct
  const w = Math.round(opts.w)
  return `${BASE.replace(/\/$/, '')}/image?src=${encodeURIComponent(direct)}&w=${w}`
}

export type Locale = 'ar' | 'en'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Translation {
  id: number
  locale: string
  name: string
}

export interface Category {
  id: number
  isActive: boolean
  translations: Translation[]
}

export interface Brand {
  id: number
  isActive: boolean
  logo?: string | null
  translations: Translation[]
}

export interface ProductImage {
  id: number
  url: string
  sortOrder: number
}

export interface Product {
  id: number
  slug: string | null
  title: string
  description: string
  condition: string
  price: number
  isActive: boolean
  showPhone: boolean
  promotedUntil: string | null
  averageRating?: number
  ratingsCount?: number
  images: ProductImage[]
  category: Category
  brand: Brand
  // `owner` is only joined by some endpoints (e.g. /products, /products/:id).
  // Endpoints like /stores/:id/products omit it, so consumers must null-check.
  owner?: {
    id: number
    type: string
    phone: string | null
    contactPhone?: string | null
    storeProfile?: { id: number; name: string; slug: string | null; logo: string | null } | null
    clientProfile?: { id: number; firstName: string; lastName?: string } | null
  }
  location?: { id: number; translations: Translation[] } | null
  createdAt: string
  updatedAt: string
}

export interface ProductListResponse {
  items: Product[]
  meta: { total: number; page: number; limit: number; pages: number }
}

export interface StoreProfile {
  id: number
  name: string
  slug: string | null
  description: string | null
  logo: string | null
  cover: string | null
  websiteUrl: string | null
  instagram: string | null
  facebook: string | null
  twitter: string | null
  tiktok: string | null
  youtube: string | null
  linkedin: string | null
  status: string
  locationId: number | null
}

export interface Store {
  id: number
  type: string
  phone: string | null
  contactPhone?: string | null
  isActive: boolean
  createdAt: string
  storeProfile: StoreProfile
}

export interface LocationNode {
  id: number
  type: string
  parentId: number | null
  isActive: boolean
  translations: Translation[]
}

export interface AuthResponse {
  user: {
    id: number
    type: string
    phone: string | null
    storeProfile?: { name: string } | null
    clientProfile?: { firstName?: string; lastName?: string } | null
  }
  accessToken: string
  refreshToken: string
}

/**
 * `POST /auth/login` returns this shape (instead of tokens) when the store's
 * subscription has expired. The client must offer one of `options` — currently
 * `pay_instapay`, `pay_mobile_wallet`, or `convert_to_client` — before login can complete.
 */
export type ExpiredLoginOption = 'convert_to_client' | 'pay_instapay' | 'pay_mobile_wallet'

export interface ExpiredLoginResponse {
  status: 'expired'
  storeType: 'store' | 'store_plus'
  currentPlanId: number | null
  options: ExpiredLoginOption[]
}

export type LoginResult = AuthResponse | ExpiredLoginResponse

export function isExpiredLogin(res: LoginResult): res is ExpiredLoginResponse {
  return (res as ExpiredLoginResponse).status === 'expired'
}

export interface UserActionFlags {
  showStoreShareDialog: boolean
  showStoreLogoDialog: boolean
  showAddProductDialog: boolean
  showSubscriptionExpiredIcon: boolean
}

export interface UserProfile {
  id: number
  type: string
  phone: string | null
  contactPhone: string | null
  isActive: boolean
  storeProfile?: StoreProfile | null
  clientProfile?: {
    id: number
    firstName: string
    lastName?: string
    status: string
  } | null
  createdAt: string
  storeShareDialogSeenAt?: string | null
  storeShareCount?: number
  flags?: UserActionFlags
}

export interface FavoriteProduct {
  id: number
  userId: number
  productId: number
  product: Product
  createdAt: string
}

export interface ProductRatingItem {
  id: number
  productId: number
  userId: number
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function localeName(translations: Translation[], locale: Locale): string {
  return (
    translations.find(t => t.locale === locale)?.name ??
    translations.find(t => t.locale === 'ar')?.name ??
    ''
  )
}

// ─── URL Helpers (mirror vatix_website/lib/api.ts) ───────────────────────────
// All share URLs prefer the slug and fall back to the numeric id, so that
// links keep working even for legacy stores/products that haven't been
// slugified yet.

type OwnerLike = {
  id: number
  type: string
  storeProfile?: { slug: string | null } | null
} | null | undefined

export function storeHref(owner: OwnerLike): string | null {
  if (!owner?.storeProfile) return null
  const t = owner.type
  const isStore = t === 'store' || t === 'STORE' || t === 'store_plus' || t === 'STORE_PLUS'
  if (!isStore) return null
  const slug = owner.storeProfile.slug
  return `/stores/${slug ?? owner.id}`
}

export function storePlusHref(owner: OwnerLike): string | null {
  if (!owner?.storeProfile) return null
  const t = owner.type
  if (t !== 'store_plus' && t !== 'STORE_PLUS') return null
  const slug = owner.storeProfile.slug
  return `/s/${slug ?? owner.id}`
}

export function productHref(product: { id: number; slug: string | null } | null | undefined): string {
  if (!product) return '/products'
  return `/products/${product.slug ?? product.id}`
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
        ...(init?.headers as Record<string, string> | undefined),
      },
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[api] NETWORK FAIL', url, String(e))
    throw e
  }
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.log('[api] HTTP', res.status, url)
    const data = await res.json().catch(() => ({}))
    const backendMsg = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message
    // Map generic HTTP failures to sentinel codes so authErrorMessage() can
    // localize them. Preserve backend text on other 4xx (validation, conflict,
    // etc.) since those messages are often the actionable part.
    let msg: string
    if (res.status === 401) msg = AUTH_ERR.UNAUTHORIZED
    else if (res.status >= 500) msg = AUTH_ERR.SERVER_ERROR
    else msg = backendMsg ?? AUTH_ERR.SERVER_ERROR
    throw new ApiError(res.status, msg, data)
  }
  return res.json() as Promise<T>
}

/** Marker returned by public fetchers when the backend responded with 410 Gone
 *  (resource exists but its owner's subscription is expired). */
export interface ExpiredResource {
  status: 'expired'
}

export function isExpiredResource(res: unknown): res is ExpiredResource {
  return (
    typeof res === 'object' &&
    res !== null &&
    (res as ExpiredResource).status === 'expired'
  )
}

async function fetchOrExpired<T>(fn: () => Promise<T>): Promise<T | ExpiredResource> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ApiError && err.status === 410) return { status: 'expired' }
    throw err
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCategories(): Promise<Category[]> {
  return apiFetch('/categories')
}

export function getBrands(): Promise<Brand[]> {
  return apiFetch('/brands')
}

export function getLocations(type?: string): Promise<LocationNode[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : ''
  return apiFetch(`/locations${q}`)
}

export interface GetProductsParams {
  page?: number
  limit?: number
  q?: string
  categoryId?: number
  brandId?: number
  locationId?: number
  minPrice?: number
  maxPrice?: number
  condition?: string
  sort?: string
  promoted?: boolean
}

export function getProducts(params?: GetProductsParams): Promise<ProductListResponse> {
  const q = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) q.set(k, String(v))
    })
  }
  return apiFetch(`/products?${q}`)
}

export function getProduct(id: number): Promise<Product | ExpiredResource> {
  return fetchOrExpired(() => apiFetch<Product>(`/products/${id}`))
}

export function getProductRatings(productId: number): Promise<ProductRatingItem[]> {
  return apiFetch(`/products/${productId}/ratings`)
}

export function getStores(): Promise<Store[]> {
  return apiFetch('/stores')
}

export function getFeaturedStores(): Promise<Store[]> {
  return apiFetch('/stores/featured')
}

export function getStoreProfile(id: number): Promise<Store | ExpiredResource> {
  return fetchOrExpired(() => apiFetch<Store>(`/stores/${id}`))
}

export interface Branch {
  id: number
  storeId: number
  name: string
  phone: string | null
  type: 'branch' | 'general'
  locationId: number | null
}

export function getStoreBranches(storeId: number): Promise<Branch[]> {
  return apiFetch(`/stores/${storeId}/branches`)
}

export function getStoreProducts(
  storeId: number,
  params?: GetProductsParams,
): Promise<ProductListResponse> {
  const q = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) q.set(k, String(v))
    })
  }
  return apiFetch(`/stores/${storeId}/products?${q}`)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function loginUser(phone: string, password: string): Promise<LoginResult> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
}

/** Expired store recovery: downgrade to client. Returns a full auth response. */
export function expiredConvertToClient(
  phone: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch('/auth/expired/convert-to-client', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
}

/**
 * Expired store recovery: submit an InstaPay renewal. Returns a payment id
 * pending admin review — no tokens are issued until the admin approves.
 * NB: backend DTO names the URL field `screenshotKey` even though it's a URL.
 */
export function expiredPayInstapay(
  phone: string,
  password: string,
  screenshotKey: string,
  buyerPhone: string,
): Promise<{ paymentId: number; status: 'pending_verification' }> {
  return apiFetch('/auth/expired/pay-instapay', {
    method: 'POST',
    body: JSON.stringify({ phone, password, screenshotKey, buyerPhone }),
  })
}

/**
 * Expired store recovery: submit a Mobile Wallet renewal. Same lifecycle as
 * InstaPay — the admin must approve before tokens are issued.
 */
export function expiredPayMobileWallet(
  phone: string,
  password: string,
  screenshotKey: string,
  buyerPhone: string,
): Promise<{ paymentId: number; status: 'pending_verification' }> {
  return apiFetch('/auth/expired/pay-mobile-wallet', {
    method: 'POST',
    body: JSON.stringify({ phone, password, screenshotKey, buyerPhone }),
  })
}

/**
 * Anonymous public upload — used by pre-auth flows (e.g. expired-store InstaPay
 * screenshots) where no JWT is available. Throttled 5/60s by the backend.
 * Returns the public MinIO URL.
 */
export async function uploadPublic(
  localUri: string,
  mimeType: string = 'image/jpeg',
): Promise<string> {
  const form = new FormData()
  const filename = localUri.split('/').pop() ?? `upload-${Date.now()}.jpg`
  // React Native FormData accepts { uri, name, type } file objects.
  form.append('file', {
    uri: localUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob)
  const res = await fetch(`${BASE}/uploads/public`, {
    method: 'POST',
    body: form,
    headers: { 'X-Client-Platform': 'mobile' },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? 'Upload failed')
    throw new ApiError(res.status, msg, data)
  }
  const json = (await res.json()) as { url: string }
  return json.url
}

export function registerClient(data: {
  phone: string
  password: string
  firstName: string
  lastName?: string
  contactPhone?: string
}): Promise<AuthResponse> {
  return apiFetch('/auth/register/client', { method: 'POST', body: JSON.stringify(data) })
}

export function registerStore(data: {
  phone: string
  password: string
  type: 'store' | 'store_plus'
  storeName: string
  description?: string
  locationId?: number
}): Promise<AuthResponse> {
  return apiFetch('/auth/register/store', { method: 'POST', body: JSON.stringify(data) })
}

// ─── Authenticated product creation ──────────────────────────────────────────

export type ProductCondition =
  | 'new'
  | 'used_excellent'
  | 'used_good'
  | 'used_acceptable'

export interface CreateProductInput {
  title: string
  description?: string
  condition?: ProductCondition
  price: number
  categoryId: number
  brandId?: number
  locationId?: number
  showPhone?: boolean
  images?: { url: string; sortOrder?: number }[]
}

export interface Notification {
  id: number
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export interface Message {
  id: number
  conversationId?: number
  senderId: number
  content: string
  isRead?: boolean
  createdAt: string
}

export interface ConversationListItem {
  id: number
  productId: number | null
  product: { id: number; title: string; image: string | null } | null
  createdAt: string
  updatedAt: string
  otherUser: { id: number; displayName: string; isStore: boolean; logo: string | null }
  lastMessage: Message | null
  unreadCount: number
}

export interface ConversationDetail {
  conversation: {
    id: number
    user1Id: number
    user2Id: number
    productId: number | null
    product: { id: number; title: string; image: string | null } | null
    createdAt: string
    updatedAt: string
  }
  messages: Message[]
}

export function checkPhoneAvailable(phone: string): Promise<{ available: boolean }> {
  return apiFetch(`/auth/check-phone?phone=${encodeURIComponent(phone)}`)
}

export function sendOtp(phone: string): Promise<void> {
  return apiFetch('/auth/verify/send', { method: 'POST', body: JSON.stringify({ phone }) })
}

export function checkOtp(phone: string, code: string): Promise<{ verified: boolean }> {
  return apiFetch('/auth/verify/check', { method: 'POST', body: JSON.stringify({ phone, code }) })
}

export function resetPassword(
  phone: string,
  code: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ phone, code, newPassword }),
  })
}

// ============================================================================
// Phase 4 — Monetization Tier types & public fetchers
// ============================================================================

export type SubscriptionStatus = 'trial' | 'active' | 'expired'
export type PaymentStatus = 'success' | 'pending' | 'failed' | 'pending_verification'
export type PaymentMethod = 'instapay' | 'wallet' | 'mobile_wallet'

export interface SubStatus {
  type: string
  subscriptionStatus: SubscriptionStatus | null
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  daysLeft: number | null
  subDaysLeft: number | null
}

export interface PlanData {
  id: number
  storeType: string
  price: string | number
  isActive: boolean
}

export interface PaymentRecord {
  id: number
  type: string
  amount: number
  status: PaymentStatus | string
  method: PaymentMethod | string | null
  createdAt: string
}

export interface WalletBalance {
  balance: number
  totalToppedUp: number
  totalSpent: number
}

export interface BundleTranslation {
  id: number
  locale: string
  name: string
  description: string | null
  bundleId: number
}

export interface Bundle {
  id: number
  name: string
  description: string | null
  productCount: number
  price: number | string
  isActive: boolean
  translations: BundleTranslation[]
  createdAt?: string
  updatedAt?: string
}

export interface PromoInfo {
  total: number
}

export interface PromotedProductItem {
  productId: number
  title: string
  price: number
  image: string | null
  promotedUntil: string
  status: 'active' | 'completed'
  method: 'wallet' | 'instapay' | 'gift' | null
  promotedAt: string | null
}

export interface PromotionHistoryRow {
  id: number
  credits: number
  method: 'wallet' | 'instapay' | 'gift' | null
  status: 'pending' | 'pending_verification' | 'success' | 'failed'
  amount: number
  currency: string
  adminGrant: boolean
  gift: boolean
  createdAt: string
}

export interface ProductRow {
  id: number
  title: string
  imageUrl: string | null
  views: number
  phoneClicks: number
  favorites: number
  isActive: boolean
}

export interface DayRow {
  date: string
  views: number
}

export interface Analytics {
  totalProducts: number
  activeProducts: number
  totalViews: number
  totalPhoneClicks: number
  totalFavorites: number
  products: ProductRow[]
  viewsByDay: DayRow[]
}

export interface SiteSettings {
  instapayEnabled: boolean
  instapayAccount: string | null
  instapayName: string | null
  mobileWalletEnabled: boolean
  mobileWalletAccount: string | null
  mobileWalletName: string | null
  otpVerificationEnabled: boolean
  email: string | null
  phone: string | null
  whatsapp: string | null
  twitter: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  youtube: string | null
  linkedin: string | null
  iosMinVersion: string | null
  iosLatestVersion: string | null
  iosStoreUrl: string | null
  androidMinVersion: string | null
  androidLatestVersion: string | null
  androidStoreUrl: string | null
  maxProductsPerClient: number
  maxActiveProductsPerStore: number
}

export function getSubscriptionPlans(): Promise<PlanData[]> {
  return apiFetch('/subscriptions/plans')
}

export function getPromotionBundles(): Promise<Bundle[]> {
  return apiFetch('/promotions/bundles')
}

export function getSiteSettings(): Promise<SiteSettings> {
  return apiFetch('/site-settings')
}

export interface SiteStats {
  users: number
  stores: number
  products: number
}

export function getSiteStats(): Promise<SiteStats> {
  return apiFetch('/site-stats')
}
