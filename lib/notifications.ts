import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { authDelete, authPost } from './auth'
import { answerBroAvailability } from './bro'

// Expo SDK 54 notification handler — `shouldShowAlert` is deprecated;
// use the `shouldShowBanner` + `shouldShowList` split instead.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function resolveProjectId(): string | undefined {
  const cfg = Constants
  const fromExpoConfig = cfg?.expoConfig?.extra?.eas?.projectId
  const fromEasConfig = (cfg as { easConfig?: { projectId?: string } })?.easConfig?.projectId
  return fromExpoConfig ?? fromEasConfig
}

async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync()
  if (existing.status === 'granted') return true
  const asked = await Notifications.requestPermissionsAsync()
  return asked.status === 'granted'
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F5B800',
    sound: 'default',
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
  })
}

async function fetchExpoPushToken(): Promise<string | null> {
  const projectId = resolveProjectId()
  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    return token.data ?? null
  } catch {
    return null
  }
}

async function savePushTokenToBackend(token: string): Promise<void> {
  try {
    await authPost('/notifications/push-token', {
      token,
      platform: Platform.OS,
    })
  } catch {
    // swallow — a failure here should not block login
  }
}

let _currentToken: string | null = null

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null
  await ensureAndroidChannel()
  const granted = await ensurePermission()
  if (!granted) return null
  const token = await fetchExpoPushToken()
  if (!token) return null
  _currentToken = token
  await savePushTokenToBackend(token)
  return token
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = _currentToken ?? (await fetchExpoPushToken())
  if (!token) return
  _currentToken = null
  await authDelete('/notifications/push-token', { token }).catch(() => undefined)
}

// Geeko "is it still available?" push — the seller answers from the
// notification itself. Buttons only show once the category is registered.
const BRO_ASK_CATEGORY = 'bro_ask'
const BRO_ACTION_AVAILABLE = 'bro_available'
const BRO_ACTION_SOLD = 'bro_sold'

async function ensureNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(BRO_ASK_CATEGORY, [
    { identifier: BRO_ACTION_AVAILABLE, buttonTitle: '✅ متاح', options: { opensAppToForeground: true } },
    { identifier: BRO_ACTION_SOLD, buttonTitle: 'اتباع', options: { opensAppToForeground: false } },
  ])
}

type NotificationDataRoute = {
  route?: string
  productId?: number | string
  storeId?: number | string
  conversationId?: number | string
  broRequestId?: number | string
  inquiryId?: number | string
}

function routeFromData(data: NotificationDataRoute | undefined): string | null {
  if (!data) return null
  if (data.route && typeof data.route === 'string') return data.route
  if (data.broRequestId != null) return `/bro/requests/${data.broRequestId}`
  if (data.productId != null) return `/products/${data.productId}`
  if (data.storeId != null) return `/store/${data.storeId}`
  if (data.conversationId != null) return `/dashboard/messages/${data.conversationId}`
  return null
}

// Guard against the same cold-start response being routed twice
// (getLastNotificationResponseAsync + response listener can both fire for it).
let _handledResponseIds = new Set<string>()

function navigateFromResponse(response: Notifications.NotificationResponse, source: string): void {
  const id = response.notification.request.identifier
  if (_handledResponseIds.has(id)) return
  _handledResponseIds.add(id)
  const data = response.notification.request.content.data as NotificationDataRoute | undefined
  const path = routeFromData(data)
  console.log(`[push] tapped (${source})`, { id, action: response.actionIdentifier, data, path })
  const inquiryId = data?.inquiryId != null ? Number(data.inquiryId) : NaN
  if (Number.isInteger(inquiryId) && inquiryId > 0) {
    if (response.actionIdentifier === BRO_ACTION_SOLD) {
      void markBroSoldFromPush(inquiryId, id, path)
      return
    }
    if (response.actionIdentifier === BRO_ACTION_AVAILABLE) {
      // The bro_ask push route is the chat conversation, so build the seller screen path directly.
      openPath(`/bro/i/${inquiryId}?src=push_action`)
      return
    }
  }
  openPath(path)
}

async function markBroSoldFromPush(inquiryId: number, notificationId: string, fallback: string | null): Promise<void> {
  try {
    await answerBroAvailability(inquiryId, false, 'push_action')
    await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined)
  } catch (err) {
    console.warn('[push] bro sold action failed', inquiryId, err)
    openPath(fallback ?? `/bro/i/${inquiryId}`)
  }
}

function openPath(path: string | null): void {
  if (!path) return
  // Defer one tick so the root Stack is mounted before router.push runs —
  // required on cold start where the response fires before layout renders.
  setTimeout(() => {
    try {
      router.push(path as never)
    } catch (err) {
      console.warn('[push] router.push failed', path, err)
    }
  }, 300)
}

export function attachNotificationTapHandler(): () => void {
  ensureNotificationCategories().catch(() => undefined)

  // Cold start: the tap that launched the app fired before this handler
  // was attached, so pull it from the OS via getLastNotificationResponseAsync.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) navigateFromResponse(response, 'cold-start')
    })
    .catch(() => undefined)

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data
    console.log('[push] received (foreground)', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data,
    })
  })
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromResponse(response, 'warm')
  })
  return () => {
    receivedSub.remove()
    responseSub.remove()
  }
}
