import { Platform } from 'react-native'
import Constants from 'expo-constants'
import type {
  EventSubscription,
  Product,
  ProductSubscription,
  Purchase,
  PurchaseError,
} from 'react-native-iap'

// StoreKit 2 wrapper — iOS only. Per the locked payment matrix, IAP is the sole
// digital-goods path on iOS; Android/web use InstaPay / mobile wallet / balance.
// All calls on non-iOS or inside Expo Go return safe no-ops so this module can
// be imported freely. `react-native-iap` uses NitroModules which crash on load
// inside Expo Go, so the native module is required lazily (never at top level).

const IS_IOS = Platform.OS === 'ios'
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient'
const IAP_AVAILABLE = IS_IOS && !IS_EXPO_GO

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadIap(): any | null {
  if (!IAP_AVAILABLE) return null
  // Lazy require so Expo Go / Android never touch the native NitroModule.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-iap')
}

export type IosProductType = 'in-app' | 'subs'

export async function initIap(): Promise<boolean> {
  const iap = loadIap()
  if (!iap) return false
  try {
    await iap.initConnection()
    return true
  } catch (e) {
    console.warn('[IAP] initConnection failed:', e)
    return false
  }
}

export async function endIap(): Promise<void> {
  const iap = loadIap()
  if (!iap) return
  try {
    await iap.endConnection()
  } catch {
    // ignore — cleanup only
  }
}

export async function fetchIosProducts(
  skus: string[],
  type: IosProductType,
): Promise<(Product | ProductSubscription)[]> {
  const iap = loadIap()
  if (!iap || skus.length === 0) return []
  // initConnection() is idempotent; call it directly (not via initIap) so a
  // real init failure surfaces here instead of falling through to fetchProducts
  // and masquerading as a "Connection not initialized" error.
  try {
    await iap.initConnection()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const wrapped = new Error(`IAP_INIT_FAILED: ${msg}`)
    ;(wrapped as Error & { code?: string }).code = 'IAP_INIT_FAILED'
    throw wrapped
  }
  try {
    const res = await iap.fetchProducts({ skus, type })
    const list = (res ?? []) as (Product | ProductSubscription)[]
    console.warn(
      `[IAP] fetchProducts type=${type} requested=${JSON.stringify(skus)} got=${JSON.stringify(list.map(p => p?.id))}`,
    )
    return list
  } catch (e) {
    console.warn(
      `[IAP] fetchProducts threw type=${type} skus=${JSON.stringify(skus)}:`,
      e,
    )
    throw e
  }
}

// Throws AUTH_ERR.IAP_PRODUCT_UNAVAILABLE if StoreKit is missing any requested
// SKU (typically because it hasn't been included in the current review submission
// or hasn't finished processing). Callers should surface the error via
// authErrorMessage so the user sees a translated message instead of the raw
// `sku-not-found` code that OpenIAP would emit at purchase time.
export async function requireIosProduct(
  sku: string,
  type: IosProductType,
): Promise<Product | ProductSubscription> {
  const products = await fetchIosProducts([sku], type)
  const match = products.find((p) => p.id === sku)
  if (!match) {
    const returned = products.map((p) => p?.id).join(',') || '<empty>'
    const err = new Error(
      `IAP_PRODUCT_UNAVAILABLE sku=${sku} type=${type} returned=[${returned}]`,
    )
    ;(err as Error & { code?: string }).code = 'IAP_PRODUCT_UNAVAILABLE'
    throw err
  }
  return match
}

// Event-based: resolution arrives via purchaseUpdatedListener / purchaseErrorListener.
export async function requestIosPurchase(sku: string, type: IosProductType): Promise<void> {
  const iap = loadIap()
  if (!iap) return
  if (type === 'subs') {
    await iap.requestPurchase({ request: { apple: { sku } }, type: 'subs' })
  } else {
    await iap.requestPurchase({ request: { apple: { sku } }, type: 'in-app' })
  }
}

// Call ONLY after backend has verified the JWS. Finishing before verification
// loses the transaction if the server call fails.
export async function finishIosPurchase(purchase: Purchase, isConsumable: boolean): Promise<void> {
  const iap = loadIap()
  if (!iap) return
  await iap.finishTransaction({ purchase, isConsumable })
}

export async function restoreIosPurchases(): Promise<void> {
  const iap = loadIap()
  if (!iap) return
  await iap.restorePurchases()
}

// StoreKit 2 JWS payload for backend verification.
// `purchase.purchaseToken` is the unified field that carries the JWS on iOS;
// `getTransactionJwsIOS` is the explicit fallback if the listener payload is empty.
export async function getIosJws(purchase: Purchase): Promise<string | null> {
  const iap = loadIap()
  if (!iap) return null
  if (purchase.purchaseToken) return purchase.purchaseToken
  const jws = await iap.getTransactionJwsIOS(purchase.productId)
  return jws ?? null
}

export function addPurchaseUpdatedListener(
  cb: (purchase: Purchase) => void,
): EventSubscription | null {
  const iap = loadIap()
  if (!iap) return null
  return iap.purchaseUpdatedListener(cb)
}

export function addPurchaseErrorListener(
  cb: (error: PurchaseError) => void,
): EventSubscription | null {
  const iap = loadIap()
  if (!iap) return null
  return iap.purchaseErrorListener(cb)
}
