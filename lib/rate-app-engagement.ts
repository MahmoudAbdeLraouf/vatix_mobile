import * as SecureStore from 'expo-secure-store'

// Device-local engagement + cooldown tracking for the Rate-App prompt.
// Used for guests (no backend account) and as a fast path for signed-in users.
// The admin on/off flag still gates everything upstream.

export type EngagementKind =
  | 'product_view'
  | 'favorite'
  | 'store_open'
  | 'publish'
  | 'inquiry'
  | 'dashboard_visit'
  | 'session_start'

export type Audience = 'guest' | 'client' | 'store' | 'store_plus'

const KEYS = {
  product_view: 'rate_app_product_views',
  favorite: 'rate_app_favorites',
  store_open: 'rate_app_store_opens',
  publish: 'rate_app_publish_count',
  inquiry: 'rate_app_inquiry_count',
  dashboard_visit: 'rate_app_dashboard_visits',
  session_start: 'rate_app_session_count',
} satisfies Record<EngagementKind, string>

const KEY_LAST_SHOWN = 'rate_app_last_shown_at'
const KEY_DISMISSED = 'rate_app_dismissed_at'

const COOLDOWN_MS_GUEST = 60 * 24 * 60 * 60 * 1000
const COOLDOWN_MS_USER = 30 * 24 * 60 * 60 * 1000

const CLIENT_ENGAGEMENT_THRESHOLD = 3
const GUEST_VIEW_THRESHOLD = 3
const GUEST_SESSION_THRESHOLD = 2

async function readInt(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(key).catch(() => null)
  const n = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(n) ? n : 0
}

async function writeInt(key: string, value: number): Promise<void> {
  await SecureStore.setItemAsync(key, String(value)).catch(() => {})
}

async function readTimestamp(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(key).catch(() => null)
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export async function bumpEngagement(kind: EngagementKind): Promise<void> {
  const key = KEYS[kind]
  const current = await readInt(key)
  await writeInt(key, current + 1)
}

async function isInCooldown(audience: Audience): Promise<boolean> {
  const [shown, dismissed] = await Promise.all([
    readTimestamp(KEY_LAST_SHOWN),
    readTimestamp(KEY_DISMISSED),
  ])
  const last = Math.max(shown ?? 0, dismissed ?? 0)
  if (!last) return false
  const cooldown = audience === 'guest' ? COOLDOWN_MS_GUEST : COOLDOWN_MS_USER
  return Date.now() - last < cooldown
}

async function hasClientEngagement(): Promise<boolean> {
  const [views, favs, opens] = await Promise.all([
    readInt(KEYS.product_view),
    readInt(KEYS.favorite),
    readInt(KEYS.store_open),
  ])
  return (
    favs >= CLIENT_ENGAGEMENT_THRESHOLD ||
    views >= CLIENT_ENGAGEMENT_THRESHOLD ||
    opens >= 1
  )
}

async function hasStoreEngagement(): Promise<boolean> {
  const [publishes, inquiries, visits] = await Promise.all([
    readInt(KEYS.publish),
    readInt(KEYS.inquiry),
    readInt(KEYS.dashboard_visit),
  ])
  return publishes >= 1 || inquiries >= 1 || visits >= 1
}

async function hasGuestEngagement(): Promise<boolean> {
  const [views, sessions] = await Promise.all([
    readInt(KEYS.product_view),
    readInt(KEYS.session_start),
  ])
  return views >= GUEST_VIEW_THRESHOLD || sessions >= GUEST_SESSION_THRESHOLD
}

export async function shouldShowRateApp(audience: Audience): Promise<boolean> {
  if (await isInCooldown(audience)) return false
  switch (audience) {
    case 'guest':
      return hasGuestEngagement()
    case 'client':
      return hasClientEngagement()
    case 'store':
    case 'store_plus':
      return hasStoreEngagement()
  }
}

export async function markShown(): Promise<void> {
  await writeInt(KEY_LAST_SHOWN, Date.now())
}

export async function markDismissed(): Promise<void> {
  await writeInt(KEY_DISMISSED, Date.now())
}

export async function resetAll(): Promise<void> {
  const keys = [
    ...Object.values(KEYS),
    KEY_LAST_SHOWN,
    KEY_DISMISSED,
  ]
  await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k).catch(() => {})))
}
