const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'

let visitCounted = false

function fireAndForget(url: string, init?: RequestInit) {
  fetch(url, init).catch(() => {
    // analytics failures are non-critical — swallow
  })
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

export function trackSearch(keyword: string, zeroResults = false) {
  const trimmed = keyword.trim()
  if (!trimmed) return
  fireAndForget(`${API}/analytics/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: trimmed, zeroResults }),
  })
}
