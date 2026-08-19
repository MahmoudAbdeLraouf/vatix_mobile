import * as SecureStore from 'expo-secure-store'
import type { Translations } from '@/lib/i18n'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'

// Error codes thrown from this module. UI layer should translate via
// authErrorMessage(err, t) since this module has no locale context.
export const AUTH_ERR = {
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  SERVER_ERROR: 'AUTH_SERVER_ERROR',
  ACCOUNT_DELETE_FAILED: 'AUTH_ACCOUNT_DELETE_FAILED',
} as const

export function authErrorMessage(err: unknown, t: Translations): string {
  if (!(err instanceof Error)) return t.serverError
  switch (err.message) {
    case AUTH_ERR.UNAUTHORIZED:
      return t.unauthorizedError
    case AUTH_ERR.SESSION_EXPIRED:
      return t.sessionExpiredError
    case AUTH_ERR.SERVER_ERROR:
      return t.serverError
    case AUTH_ERR.ACCOUNT_DELETE_FAILED:
      return t.accountDeletionError
    default:
      return err.message || t.serverError
  }
}

const KEY_TOKEN = 'vatix_token'
const KEY_REFRESH = 'vatix_refresh'
const KEY_USER = 'vatix_user'

// ─── Token storage ────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_TOKEN)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH)
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_TOKEN, accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
  ])
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_TOKEN).catch(() => {}),
    SecureStore.deleteItemAsync(KEY_REFRESH).catch(() => {}),
    SecureStore.deleteItemAsync(KEY_USER).catch(() => {}),
  ])
}

export async function isLoggedIn(): Promise<boolean> {
  const [token, refresh] = await Promise.all([getToken(), getRefreshToken()])
  return !!(token || refresh)
}

// ─── User profile storage ─────────────────────────────────────────────────────

export interface StoredUser {
  id: number
  type: string
  phone: string | null
  displayName: string
  isStore: boolean
}

export async function saveSession(
  accessToken: string,
  refreshToken: string,
  user?: {
    id?: number
    type?: string
    phone?: string | null
    storeProfile?: { name: string } | null
    clientProfile?: { firstName?: string; lastName?: string } | null
  } | null,
): Promise<void> {
  await saveTokens(accessToken, refreshToken)
  if (!user) return

  const displayName =
    user.storeProfile?.name ??
    (user.clientProfile?.firstName
      ? `${user.clientProfile.firstName} ${user.clientProfile.lastName ?? ''}`.trim()
      : null) ??
    user.phone ??
    'مستخدم'

  const stored: StoredUser = {
    id: user.id ?? 0,
    type: user.type ?? 'client',
    phone: user.phone ?? null,
    displayName,
    isStore:
      user.type === 'STORE' ||
      user.type === 'store' ||
      user.type === 'STORE_PLUS' ||
      user.type === 'store_plus',
  }
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(stored))
}

// Normalize a raw SecureStore blob to the current StoredUser shape. Older app
// installs may have written a subset of fields (or fields of unexpected types);
// if we render such a value directly, downstream components crash on the first
// property access. Returns null when essentials (numeric id, non-empty type)
// are missing, so the caller can force a fresh login.
function normalizeStoredUser(raw: unknown): StoredUser | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  if (!Number.isFinite(id) || id <= 0) return null

  const type = typeof r.type === 'string' && r.type ? r.type : null
  if (!type) return null

  const phone = typeof r.phone === 'string' ? r.phone : null
  const displayName =
    typeof r.displayName === 'string' && r.displayName ? r.displayName : (phone ?? 'مستخدم')
  const isStore =
    typeof r.isStore === 'boolean'
      ? r.isStore
      : type === 'STORE' || type === 'store' || type === 'STORE_PLUS' || type === 'store_plus'

  return { id, type, phone, displayName, isStore }
}

export async function getStoredUser(): Promise<StoredUser | null> {
  let raw: string | null = null
  try {
    raw = await SecureStore.getItemAsync(KEY_USER)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    await SecureStore.deleteItemAsync(KEY_USER).catch(() => {})
    return null
  }

  const normalized = normalizeStoredUser(parsed)
  if (!normalized) {
    await SecureStore.deleteItemAsync(KEY_USER).catch(() => {})
    return null
  }
  return normalized
}

export async function updateStoredDisplayName(displayName: string): Promise<void> {
  const stored = await getStoredUser()
  if (!stored) return
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify({ ...stored, displayName }))
}

export async function updateStoredUser(user: {
  id?: number
  type?: string
  phone?: string | null
  storeProfile?: { name?: string } | null
  clientProfile?: { firstName?: string; lastName?: string } | null
} | null): Promise<void> {
  if (!user) return
  const existing = await getStoredUser()
  const displayName =
    user.storeProfile?.name ??
    (user.clientProfile?.firstName
      ? `${user.clientProfile.firstName} ${user.clientProfile.lastName ?? ''}`.trim()
      : null) ??
    user.phone ??
    existing?.displayName ??
    'مستخدم'

  const stored: StoredUser = {
    id: user.id ?? existing?.id ?? 0,
    type: user.type ?? existing?.type ?? 'client',
    phone: user.phone ?? existing?.phone ?? null,
    displayName,
    isStore:
      user.type === 'STORE' ||
      user.type === 'store' ||
      user.type === 'STORE_PLUS' ||
      user.type === 'store_plus',
  }
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(stored))
}

// ─── Silent token refresh ─────────────────────────────────────────────────────

let _refreshing: Promise<boolean> | null = null

export async function refreshAccessToken(): Promise<boolean> {
  if (_refreshing) return _refreshing
  _refreshing = _doRefresh().finally(() => {
    _refreshing = null
  })
  return _refreshing
}

async function _doRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const { accessToken, refreshToken: newRefresh } = (await res.json()) as {
      accessToken: string
      refreshToken: string
    }
    await saveTokens(accessToken, newRefresh)
    return true
  } catch {
    return false
  }
}

async function getValidToken(): Promise<string | null> {
  const t = await getToken()
  if (t) return t
  const ok = await refreshAccessToken()
  return ok ? getToken() : null
}

// ─── Authenticated fetch helpers ─────────────────────────────────────────────

export async function authFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = await getValidToken()
  if (!token) {
    await clearSession()
    return null
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
        Authorization: `Bearer ${token}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    })
    if (res.status === 204) return null
    if (res.status === 401) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        await clearSession()
        return null
      }
      return authFetch<T>(path, init)
    }
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

export async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getValidToken()
  if (!token) {
    await clearSession()
    throw new Error(AUTH_ERR.UNAUTHORIZED)
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      await clearSession()
      throw new Error(AUTH_ERR.SESSION_EXPIRED)
    }
    return authPost<T>(path, body)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = Array.isArray(data.message)
      ? data.message.join('، ')
      : (data.message ?? AUTH_ERR.SERVER_ERROR)
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function authPatch<T>(path: string, body: unknown): Promise<T> {
  const token = await getValidToken()
  if (!token) {
    await clearSession()
    throw new Error(AUTH_ERR.UNAUTHORIZED)
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      await clearSession()
      throw new Error(AUTH_ERR.SESSION_EXPIRED)
    }
    return authPatch<T>(path, body)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = Array.isArray(data.message)
      ? data.message.join('، ')
      : (data.message ?? AUTH_ERR.SERVER_ERROR)
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function authDelete(path: string, body?: unknown): Promise<boolean> {
  const token = await getValidToken()
  if (!token) {
    await clearSession()
    return false
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Client-Platform': 'mobile',
  }
  const init: RequestInit = { method: 'DELETE', headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      await clearSession()
      return false
    }
    return authDelete(path, body)
  }
  return res.ok || res.status === 204
}

// Same as authDelete but returns the parsed JSON body (or null on failure).
// Use when the DELETE endpoint returns useful data (e.g. refreshed counters).
export async function authDeleteJson<T>(path: string, body?: unknown): Promise<T | null> {
  const token = await getValidToken()
  if (!token) {
    await clearSession()
    return null
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Client-Platform': 'mobile',
  }
  const init: RequestInit = { method: 'DELETE', headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      await clearSession()
      return null
    }
    return authDeleteJson<T>(path, body)
  }
  if (!res.ok && res.status !== 204) return null
  if (res.status === 204) return null
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ─── Delete account ──────────────────────────────────────────────────────────

export async function deleteAccount(password: string): Promise<void> {
  const token = await getValidToken()
  if (!token) {
    await clearSession()
    throw new Error(AUTH_ERR.SESSION_EXPIRED)
  }
  const res = await fetch(`${BASE}/user/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  })
  if (res.status === 204) {
    await clearSession()
    return
  }
  const data = await res.json().catch(() => ({}))
  const msg = Array.isArray(data.message)
    ? data.message.join('، ')
    : (data.message ?? AUTH_ERR.ACCOUNT_DELETE_FAILED)
  throw new Error(msg)
}

// ─── File upload ─────────────────────────────────────────────────────────────

export async function authUploadFile(localUri: string, mimeType = 'image/jpeg'): Promise<string | null> {
  const token = await getValidToken()
  if (!token) return null

  const formData = new FormData()
  formData.append('file', {
    uri: localUri,
    type: mimeType,
    name: 'upload.jpg',
  } as unknown as Blob)

  try {
    const res = await fetch(`${BASE}/user/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Client-Platform': 'mobile' },
      body: formData,
    })
    if (!res.ok) return null
    const { url } = (await res.json()) as { url: string }
    return url
  } catch {
    return null
  }
}

// ─── Share tracking ──────────────────────────────────────────────────────────

export type ShareChannel = 'native' | 'clipboard' | 'qr' | 'social' | 'unknown'

export function logShare(targetType: 'store' | 'product', targetId: number, channel: ShareChannel): void {
  authPost(`/shares/${targetType}/${targetId}`, { channel }).catch(() => {})
}

// ─── User actions (one-off dialogs) ──────────────────────────────────────────

/** Bespoke endpoint for the store-share dialog — kept for parity with website. */
export function markStoreShareDialogSeen(): void {
  authPost('/user/profile/store-share-dialog/seen', {}).catch(() => {})
}

/** Generic tracker — first call inserts; subsequent calls bump seenCount. */
export function markActionSeen(actionKey: string): void {
  authPost(`/user/actions/${actionKey}/seen`, {}).catch(() => {})
}

export function markActionDismissed(actionKey: string): void {
  authPost(`/user/actions/${actionKey}/dismiss`, {}).catch(() => {})
}

// ─── Background proactive refresh ────────────────────────────────────────────

let _refreshInterval: ReturnType<typeof setInterval> | null = null

export function startTokenRefresher(): () => void {
  if (_refreshInterval) clearInterval(_refreshInterval)
  _refreshInterval = setInterval(async () => {
    const refresh = await getRefreshToken()
    if (refresh) refreshAccessToken()
  }, 12 * 60 * 1000)
  return () => {
    if (_refreshInterval) {
      clearInterval(_refreshInterval)
      _refreshInterval = null
    }
  }
}
