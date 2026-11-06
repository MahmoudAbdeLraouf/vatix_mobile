import * as SecureStore from 'expo-secure-store'

// Device-local engagement + cooldown tracking for the Rate-App prompt.
// One rule for every user type (guest, client, store); the admin on/off flag
// still gates everything upstream.

export type EngagementKind =
  | 'product_view'
  | 'favorite'
  | 'store_open'
  | 'publish'
  | 'inquiry'

const KEYS = {
  product_view: 'rate_app_product_views',
  favorite: 'rate_app_favorites',
  store_open: 'rate_app_store_opens',
  publish: 'rate_app_publish_count',
  inquiry: 'rate_app_inquiry_count',
} satisfies Record<EngagementKind, string>

// Distinct calendar days the app was used on, plus the last one counted.
const KEY_ACTIVE_DAYS = 'rate_app_active_days'
const KEY_LAST_ACTIVE_DAY = 'rate_app_last_active_day'

const KEY_LAST_SHOWN = 'rate_app_last_shown_at'
const KEY_DISMISSED = 'rate_app_dismissed_at'
// Set once the user taps "Rate" (dialog or Settings). The stores never tell us
// whether a review was actually left, so the tap is the strongest signal we get.
const KEY_RATED = 'rate_app_rated_at'

// Counters from the old per-audience rules — only cleared by resetAll().
const LEGACY_KEYS = ['rate_app_dashboard_visits', 'rate_app_session_count']

// Users who haven't rated are re-prompted after this long.
const COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000

// Never on the first day of use — they need to come back at least once.
const ACTIVE_DAYS_THRESHOLD = 2
// Browsing counts after a few products; every other action counts on its own.
const PRODUCT_VIEW_THRESHOLD = 3

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

function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export async function bumpEngagement(kind: EngagementKind): Promise<void> {
  const key = KEYS[kind]
  const current = await readInt(key)
  await writeInt(key, current + 1)
}

/** Counts today as an active day. Safe to call repeatedly — once per day sticks. */
export async function recordActiveDay(): Promise<void> {
  const today = localDay()
  const last = await SecureStore.getItemAsync(KEY_LAST_ACTIVE_DAY).catch(() => null)
  if (last === today) return
  await SecureStore.setItemAsync(KEY_LAST_ACTIVE_DAY, today).catch(() => {})
  await writeInt(KEY_ACTIVE_DAYS, (await readInt(KEY_ACTIVE_DAYS)) + 1)
}

async function isInCooldown(): Promise<boolean> {
  const [shown, dismissed] = await Promise.all([
    readTimestamp(KEY_LAST_SHOWN),
    readTimestamp(KEY_DISMISSED),
  ])
  const last = Math.max(shown ?? 0, dismissed ?? 0)
  if (!last) return false
  return Date.now() - last < COOLDOWN_MS
}

async function hasEngagement(): Promise<boolean> {
  const [views, favs, opens, publishes, inquiries] = await Promise.all([
    readInt(KEYS.product_view),
    readInt(KEYS.favorite),
    readInt(KEYS.store_open),
    readInt(KEYS.publish),
    readInt(KEYS.inquiry),
  ])
  return (
    views >= PRODUCT_VIEW_THRESHOLD ||
    favs >= 1 ||
    opens >= 1 ||
    publishes >= 1 ||
    inquiries >= 1
  )
}

export async function shouldShowRateApp(): Promise<boolean> {
  if (await readTimestamp(KEY_RATED)) return false
  if (await isInCooldown()) return false
  if ((await readInt(KEY_ACTIVE_DAYS)) < ACTIVE_DAYS_THRESHOLD) return false
  return hasEngagement()
}

export async function markShown(): Promise<void> {
  await writeInt(KEY_LAST_SHOWN, Date.now())
}

export async function markDismissed(): Promise<void> {
  await writeInt(KEY_DISMISSED, Date.now())
}

export async function markRated(): Promise<void> {
  await writeInt(KEY_RATED, Date.now())
}

export async function resetAll(): Promise<void> {
  const keys = [
    ...Object.values(KEYS),
    ...LEGACY_KEYS,
    KEY_ACTIVE_DAYS,
    KEY_LAST_ACTIVE_DAY,
    KEY_LAST_SHOWN,
    KEY_DISMISSED,
    KEY_RATED,
  ]
  await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k).catch(() => {})))
}
