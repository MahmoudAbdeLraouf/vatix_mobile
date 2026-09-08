import type { IosProductType } from './iap'

// App Store product IDs. Must match the SKUs configured in App Store Connect
// exactly. Reverse-DNS off the iOS bundle identifier (com.vatix.app).
export const SKU_SUBSCRIPTION_STORE = 'com.vatix.app.subscription.store'
export const SKU_SUBSCRIPTION_STORE_PLUS = 'com.vatix.app.subscription.store_plus'
export const SKU_PROMOTION_1AD = 'com.vatix.app.promo.1ad'
export const SKU_PROMOTION_3ADS = 'com.vatix.app.promo.3ads'
export const SKU_PROMOTION_5ADS = 'com.vatix.app.promo.5ads'

// Backend PaymentType values (mirrors PaymentType in vatix_backend
// src/payments/entities/payment.entity.ts). The verify endpoint keys off these
// to record the Payment row and grant entitlement.
export type BackendPaymentType =
  | 'subscription_store'
  | 'subscription_store_plus'
  | 'promotion_1ad'
  | 'promotion_3ads'
  | 'promotion_5ads'

export type IapProduct = {
  sku: string
  type: IosProductType
  paymentType: BackendPaymentType
  // Consumables (promotions) must be finished with isConsumable=true so they
  // can be repurchased. Subscriptions are non-consumable and finished with false.
  isConsumable: boolean
}

export const IAP_PRODUCTS: Record<string, IapProduct> = {
  [SKU_SUBSCRIPTION_STORE]: {
    sku: SKU_SUBSCRIPTION_STORE,
    type: 'subs',
    paymentType: 'subscription_store',
    isConsumable: false,
  },
  [SKU_SUBSCRIPTION_STORE_PLUS]: {
    sku: SKU_SUBSCRIPTION_STORE_PLUS,
    type: 'subs',
    paymentType: 'subscription_store_plus',
    isConsumable: false,
  },
  [SKU_PROMOTION_1AD]: {
    sku: SKU_PROMOTION_1AD,
    type: 'in-app',
    paymentType: 'promotion_1ad',
    isConsumable: true,
  },
  [SKU_PROMOTION_3ADS]: {
    sku: SKU_PROMOTION_3ADS,
    type: 'in-app',
    paymentType: 'promotion_3ads',
    isConsumable: true,
  },
  [SKU_PROMOTION_5ADS]: {
    sku: SKU_PROMOTION_5ADS,
    type: 'in-app',
    paymentType: 'promotion_5ads',
    isConsumable: true,
  },
}

export const SUBSCRIPTION_SKUS: string[] = [
  SKU_SUBSCRIPTION_STORE,
  SKU_SUBSCRIPTION_STORE_PLUS,
]

export const PROMOTION_SKUS: string[] = [
  SKU_PROMOTION_1AD,
  SKU_PROMOTION_3ADS,
  SKU_PROMOTION_5ADS,
]

export function getIapProduct(sku: string): IapProduct | undefined {
  return IAP_PRODUCTS[sku]
}

export function subscriptionSkuForStoreType(
  storeType: 'store' | 'store_plus',
): string {
  return storeType === 'store_plus' ? SKU_SUBSCRIPTION_STORE_PLUS : SKU_SUBSCRIPTION_STORE
}

export function promotionSkuForCount(count: 1 | 3 | 5): string {
  if (count === 5) return SKU_PROMOTION_5ADS
  if (count === 3) return SKU_PROMOTION_3ADS
  return SKU_PROMOTION_1AD
}

// EGP prices matching the tiers configured in App Store Connect.
// Why: Apple takes ~25.4% commission in Egypt (proceeds/customerPrice ≈ 0.7456),
// so tiers are chosen where proceeds roughly equal the backend price
// (150/390/500 promo; 450/750 subs). These values are the UI fallback whenever
// StoreKit is unreachable (Expo Go, dev builds, offline, or before an SKU is
// Approved) — they prevent sticker-shock later when the App Store price replaces them.
export const IOS_FALLBACK_PRICE_EGP: Record<string, number> = {
  [SKU_SUBSCRIPTION_STORE]: 599.99,
  [SKU_SUBSCRIPTION_STORE_PLUS]: 999.99,
  [SKU_PROMOTION_1AD]: 199.99,
  [SKU_PROMOTION_3ADS]: 519.99,
  [SKU_PROMOTION_5ADS]: 669.99,
}

export function iosFallbackDisplayPrice(sku: string): string | undefined {
  const v = IOS_FALLBACK_PRICE_EGP[sku]
  return v === undefined ? undefined : `${v} EGP`
}
