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
    whatsapp?: string | null
    storeProfile?: { id: number; name: string; logo: string | null } | null
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
  whatsapp?: string | null
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

export interface UserProfile {
  id: number
  type: string
  phone: string | null
  whatsapp: string | null
  isActive: boolean
  storeProfile?: StoreProfile | null
  clientProfile?: {
    id: number
    firstName: string
    lastName?: string
    status: string
  } | null
  createdAt: string
}

export interface FavoriteProduct {
  id: number
  userId: number
  productId: number
  product: Product
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function localeName(translations: Translation[], locale: Locale): string {
  return (
    translations.find(t => t.locale === locale)?.name ??
    translations.find(t => t.locale === 'ar')?.name ??
    ''
  )
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
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
    const msg = Array.isArray(data.message)
      ? data.message.join(', ')
      : (data.message ?? 'خطأ في الخادم')
    throw new Error(msg)
  }
  return res.json() as Promise<T>
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

export function getProduct(id: number): Promise<Product> {
  return apiFetch(`/products/${id}`)
}

export function getStores(): Promise<Store[]> {
  return apiFetch('/stores')
}

export function getFeaturedStores(): Promise<Store[]> {
  return apiFetch('/stores/featured')
}

// Public `GET /stores/:id` doesn't exist — mirror the website and filter locally.
export async function getStoreProfile(id: number): Promise<Store> {
  const stores = await getStores()
  const store = stores.find(s => s.id === id)
  if (!store) throw new Error('Store not found')
  return store
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

export function loginUser(phone: string, password: string): Promise<AuthResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
}

export function registerClient(data: {
  phone: string
  password: string
  firstName: string
  lastName?: string
  whatsapp?: string
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
export type PaymentMethod = 'paymob' | 'kashier' | 'instapay' | 'wallet'

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
  paymobTransactionId: string | null
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

export interface PromoPack {
  id: number
  userId: number
  remaining: number
  boostDays: number
  createdAt: string
}

export interface PromoInfo {
  total: number
  packs: PromoPack[]
}

export interface PromotionOrderProduct {
  id: number
  orderId: number
  productId: number
  product: {
    id: number
    title: string
    images?: { url: string }[]
  }
}

export interface PromotionOrderItem {
  id: number
  storeId: number
  bundleId: number
  status: 'active' | 'expired' | 'cancelled'
  startDate: string
  endDate: string
  amount: number
  notes: string | null
  bundle: {
    id: number
    name: string
    productCount: number
    price: number | string
  } | null
  products: PromotionOrderProduct[]
  createdAt: string
}

export interface PromotedProductItem {
  id: number
  title: string
  imageUrl: string | null
  promotedUntil: string
  daysLeft: number
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
  kashierEnabled: boolean
  instapayEnabled: boolean
  instapayAccount: string | null
  instapayName: string | null
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
