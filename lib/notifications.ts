import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { authDelete, authPost } from './auth'

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

type NotificationDataRoute = {
  route?: string
  productId?: number | string
  storeId?: number | string
  conversationId?: number | string
}

function routeFromData(data: NotificationDataRoute | undefined): string | null {
  if (!data) return null
  if (data.route && typeof data.route === 'string') return data.route
  if (data.productId != null) return `/products/${data.productId}`
  if (data.storeId != null) return `/store/${data.storeId}`
  if (data.conversationId != null) return `/dashboard/messages/${data.conversationId}`
  return null
}

export function attachNotificationTapHandler(): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data
    console.log('[push] received (foreground)', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data,
    })
  })
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationDataRoute | undefined
    console.log('[push] tapped', data)
    const path = routeFromData(data)
    if (path) router.push(path as never)
  })
  return () => {
    receivedSub.remove()
    responseSub.remove()
  }
}
