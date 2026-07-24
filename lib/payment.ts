import * as WebBrowser from 'expo-web-browser'

import type { PaymentStatus, UserProfile } from './api'
import {
  authFetch,
  authPost,
  refreshAccessToken,
  updateStoredUser,
} from './auth'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentContext = 'subscription' | 'promotion' | 'wallet_topup'
export type PaymentGateway = 'paymob' | 'kashier'
export type PaymentMethodChoice = 'card' | 'instapay' | 'wallet'
export type SubscriptionType = 'subscription_store' | 'subscription_store_plus'

export interface PaymobInitResponse {
  paymentKey: string
  iframeUrl: string
  paymentId: number
  iframeId?: string
}

export interface KashierInitResponse {
  sessionUrl: string
  paymentId: number
}

export interface PaymentStatusResponse {
  id: number
  status: PaymentStatus | string
  method: string | null
  amount: number
  type: string
}

// ─── PayMob initiators ────────────────────────────────────────────────────────

export function initiatePaymobSubscription(input: {
  type: SubscriptionType
  metadata?: Record<string, unknown>
}): Promise<PaymobInitResponse> {
  return authPost<PaymobInitResponse>('/payments/subscriptions', input)
}

export function initiatePaymobPromotion(input: {
  bundleId: number
}): Promise<PaymobInitResponse> {
  return authPost<PaymobInitResponse>('/payments/promotions', input)
}

export function initiatePaymobWalletTopup(input: {
  amount: number
}): Promise<PaymobInitResponse> {
  return authPost<PaymobInitResponse>('/payments/wallet/topup/card', input)
}

// ─── Kashier initiators ───────────────────────────────────────────────────────

export function initiateKashierSubscription(input: {
  type: SubscriptionType
  metadata?: Record<string, unknown>
}): Promise<KashierInitResponse> {
  return authPost<KashierInitResponse>('/payments/kashier/subscriptions', input)
}

export function initiateKashierPromotion(input: {
  bundleId: number
}): Promise<KashierInitResponse> {
  return authPost<KashierInitResponse>('/payments/kashier/promotions', input)
}

export function initiateKashierWalletTopup(input: {
  amount: number
}): Promise<KashierInitResponse> {
  return authPost<KashierInitResponse>('/payments/kashier/wallet-topup', input)
}

// ─── InstaPay initiators ──────────────────────────────────────────────────────

export interface InstapayPayload {
  screenshotUrl: string
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

// ─── Verify + poll helpers ────────────────────────────────────────────────────

export async function verifyPaymobRedirect(
  paymentId: number,
  params: Record<string, string>,
): Promise<{ status: PaymentStatus | string } | null> {
  try {
    const res = await fetch(`${BASE}/payments/verify-redirect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, params }),
    })
    if (!res.ok) return null
    return (await res.json()) as { status: PaymentStatus | string }
  } catch {
    return null
  }
}

export async function confirmKashierRedirect(
  paymentId: number,
  params: Record<string, string>,
): Promise<{ status: PaymentStatus | string } | null> {
  try {
    const res = await fetch(`${BASE}/payments/kashier/${paymentId}/confirm-redirect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) return null
    return (await res.json()) as { status: PaymentStatus | string }
  } catch {
    return null
  }
}

export interface PollOptions {
  maxTries?: number
  intervalMs?: number
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export async function pollPaymobStatus(
  paymentId: number,
  opts: PollOptions = {},
): Promise<PaymentStatusResponse | null> {
  const { maxTries = 8, intervalMs = 2500 } = opts
  for (let i = 0; i < maxTries; i++) {
    const res = await authFetch<PaymentStatusResponse>(`/payments/${paymentId}/status`)
    if (res && res.status && res.status !== 'pending') return res
    if (i < maxTries - 1) await sleep(intervalMs)
  }
  return null
}

export async function pollKashierStatus(
  paymentId: number,
  opts: PollOptions = {},
): Promise<PaymentStatusResponse | null> {
  const { maxTries = 10, intervalMs = 2500 } = opts
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch(`${BASE}/payments/kashier/${paymentId}/status`)
      if (res.ok) {
        const data = (await res.json()) as PaymentStatusResponse
        if (data.status && data.status !== 'pending') return data
      }
    } catch {
      // swallow and retry
    }
    if (i < maxTries - 1) await sleep(intervalMs)
  }
  return null
}

// ─── Browser helper ───────────────────────────────────────────────────────────

export async function openGatewayInBrowser(
  url: string,
): Promise<WebBrowser.WebBrowserResult> {
  return WebBrowser.openBrowserAsync(url, {
    dismissButtonStyle: 'close',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    showTitle: false,
    enableBarCollapsing: false,
  })
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
