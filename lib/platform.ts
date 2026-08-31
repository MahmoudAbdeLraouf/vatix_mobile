import { Platform } from 'react-native'

// App Store §3.1.1: iOS builds cannot expose any digital-goods purchase surface
// (subscriptions, ad promotion, wallet top-up, InstaPay / mobile-wallet transfers)
// because we do not use Apple IAP. All paid entry points must be hidden on iOS.
// Read-only affordances (balance, credits, history, invoices) remain visible.
export const IS_IOS = Platform.OS === 'ios'
export const IS_ANDROID = Platform.OS === 'android'
export const PAID_UI_ENABLED = Platform.OS === 'android'
