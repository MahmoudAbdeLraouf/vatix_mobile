import type { UserProfile } from './api'
import {
  authFetch,
  authPost,
  refreshAccessToken,
  updateStoredUser,
} from './auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentContext = 'subscription' | 'promotion' | 'wallet_topup'
export type PaymentMethodChoice =
  | 'instapay'
  | 'wallet'
  | 'mobile_wallet'
  | 'apple_iap'
export type SubscriptionType = 'subscription_store' | 'subscription_store_plus'

// ─── InstaPay initiators ──────────────────────────────────────────────────────

export interface InstapayPayload {
  screenshotKey: string
  buyerPhone: string
}

export function initiateInstapaySubscription(input: InstapayPayload & {
  type: SubscriptionType
  metadata?: Record<string, unknown>
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/instapay/subscriptions', input)
}

export function initiateInstapayPromotion(input: InstapayPayload & {
  bundleId: number
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/promotions/instapay', input)
}

export function initiateInstapayWalletTopup(input: InstapayPayload & {
  amount: number
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/wallet/topup/instapay', input)
}

// ─── Mobile Wallet initiators ─────────────────────────────────────────────────

export interface MobileWalletPayload {
  screenshotKey: string
  buyerPhone: string
}

export function initiateMobileWalletSubscription(input: MobileWalletPayload & {
  type: SubscriptionType
  metadata?: Record<string, unknown>
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/mobile-wallet/subscriptions', input)
}

export function initiateMobileWalletPromotion(input: MobileWalletPayload & {
  bundleId: number
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/promotions/mobile-wallet', input)
}

export function initiateMobileWalletTopup(input: MobileWalletPayload & {
  amount: number
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/wallet/topup/mobile-wallet', input)
}

// ─── Wallet payments ──────────────────────────────────────────────────────────

export function payWithWalletForSubscription(input: {
  type: SubscriptionType
  metadata?: Record<string, unknown>
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/wallet/pay', input)
}

export function payWithWalletForPromotion(input: {
  bundleId: number
}): Promise<{ paymentId: number; status: string }> {
  return authPost('/payments/promotions/wallet', input)
}

// ─── Apple IAP (iOS) ──────────────────────────────────────────────────────────

export interface IapVerifyResult {
  id: number
  status: string
  type: string
  method: string
  amount: number
}

export function verifyIapPurchase(input: {
  signedTransaction: string
  metadata?: Record<string, unknown>
}): Promise<IapVerifyResult> {
  return authPost('/payments/iap/verify', input)
}

// ─── Payment methods discovery ────────────────────────────────────────────────

export function fetchAvailablePaymentMethods(
  context: PaymentContext,
): Promise<{ methods: PaymentMethodChoice[] } | null> {
  return authFetch(`/payments/methods?context=${context}`)
}

// ─── Post-success cleanup ─────────────────────────────────────────────────────

export async function finalizePaymentSuccess(): Promise<UserProfile | null> {
  await refreshAccessToken()
  const profile = await authFetch<UserProfile>('/user/profile')
  if (profile) {
    await updateStoredUser({
      id: profile.id,
      type: profile.type,
      phone: profile.phone,
      storeProfile: profile.storeProfile
        ? { name: profile.storeProfile.name }
        : null,
      clientProfile: profile.clientProfile
        ? {
            firstName: profile.clientProfile.firstName,
            lastName: profile.clientProfile.lastName,
          }
        : null,
    })
  }
  return profile
}
