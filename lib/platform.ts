import { Platform } from 'react-native'

// Payment matrix (locked):
//   iOS subscription       → apple_iap + wallet
//   iOS ad promotion       → apple_iap + wallet
//   iOS wallet top-up      → hidden (no IAP route; users can't add funds on iOS)
//   Android/web (all ctxs) → instapay + mobile_wallet + wallet
//
// PAID_UI_ENABLED gates surfaces that require InstaPay / mobile-wallet transfers
// (wallet top-up). SUBSCRIPTION_UI_ENABLED and PROMOTION_UI_ENABLED gate paid
// entry points that iOS now supports via Apple IAP.
export const IS_IOS = Platform.OS === 'ios'
export const IS_ANDROID = Platform.OS === 'android'
export const PAID_UI_ENABLED = Platform.OS === 'android'
export const SUBSCRIPTION_UI_ENABLED = true
export const PROMOTION_UI_ENABLED = true
