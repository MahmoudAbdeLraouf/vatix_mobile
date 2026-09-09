import { Platform } from 'react-native'
import { visitorIdHeader } from '@/lib/visitor-id'
import { getToken } from '@/lib/auth'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'
const CLIENT_PLATFORM = Platform.OS

let visitCounted = false

// Backend distinguishes traffic via X-Client-Platform ('ios' | 'android' | 'web').
// iOS gating for IAP-only payment methods keys off the same header, so it must
// reflect the actual device OS — not a generic 'mobile' literal.
function fireAndForget(url: string, init?: RequestInit) {
  void (async () => {
    const headers: Record<string, string> = {
      'X-Client-Platform': CLIENT_PLATFORM,
      ...(await visitorIdHeader()),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    }
    fetch(url, { ...init, headers }).catch(() => {
      // analytics failures are non-critical — swallow
    })
  })()
}

export function trackHomepageView() {
  if (visitCounted) return
  visitCounted = true
  fireAndForget(`${API}/analytics/homepage-view`, { method: 'POST' })
}

export function trackProductView(productId: number) {
  if (!Number.isFinite(productId) || productId <= 0) return
  fireAndForget(`${API}/products/${productId}/view`, { method: 'POST' })
}

export function trackStoreView(storeId: number) {
  if (!Number.isFinite(storeId) || storeId <= 0) return
  fireAndForget(`${API}/stores/${storeId}/view`, { method: 'POST' })
}

export function trackStorePhoneClick(storeId: number) {
  if (!Number.isFinite(storeId) || storeId <= 0) return
  fireAndForget(`${API}/stores/${storeId}/phone-click`, { method: 'POST' })
}

export function trackStoreWhatsappClick(storeId: number) {
  if (!Number.isFinite(storeId) || storeId <= 0) return
  fireAndForget(`${API}/stores/${storeId}/whatsapp-click`, { method: 'POST' })
}

export function trackProductPhoneClick(productId: number) {
  if (!Number.isFinite(productId) || productId <= 0) return
  fireAndForget(`${API}/products/${productId}/phone-click`, { method: 'POST' })
}

export function trackProductWhatsappClick(productId: number) {
  if (!Number.isFinite(productId) || productId <= 0) return
  fireAndForget(`${API}/products/${productId}/whatsapp-click`, { method: 'POST' })
}

// Pings /analytics/pulse so the backend can count this device as a daily
// active visitor (Redis HyperLogLog + site_visitors UPSERT). Attaches the
// bearer token when the user is signed in so the row can be linked to a
// userId; anonymous devices are counted by X-Visitor-Id alone.
export function trackPulse() {
  void (async () => {
    const headers: Record<string, string> = {
      'X-Client-Platform': CLIENT_PLATFORM,
      ...(await visitorIdHeader()),
    }
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    fetch(`${API}/analytics/pulse`, { method: 'POST', headers }).catch(() => {})
  })()
}

export function trackSearch(keyword: string, zeroResults = false) {
  const trimmed = keyword.trim()
  if (!trimmed) return
  fireAndForget(`${API}/analytics/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: trimmed, zeroResults }),
  })
}
