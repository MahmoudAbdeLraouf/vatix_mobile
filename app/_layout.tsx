import { useEffect, useState } from 'react'
import { I18nManager } from 'react-native'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { useFonts } from 'expo-font'
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo'
import {
  Tajawal_400Regular,
  Tajawal_700Bold,
} from '@expo-google-fonts/tajawal'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/contexts/auth'
import { LocaleProvider, useLocale } from '@/contexts/locale'
import { LoginGateProvider } from '@/contexts/loginGate'
import { trackHomepageView } from '@/lib/analytics'
import { attachNotificationTapHandler } from '@/lib/notifications'
import { getSiteSettings, type SiteSettings } from '@/lib/api'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { StoreShareDialogTrigger } from '@/components/StoreShareDialogTrigger'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { installGlobalErrorHandler } from '@/lib/globalErrorHandler'

if (__DEV__) installGlobalErrorHandler()

SplashScreen.preventAutoHideAsync()

// Persist the RTL preference for standalone / dev-client builds. In Expo Go
// this is a no-op for the current session (Expo Go always launches LTR
// regardless), but does no harm — the actual layout mirroring is done in JS
// by RootStack's contentStyle below.
I18nManager.allowRTL(true)

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
    Tajawal_400Regular,
    Tajawal_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  useEffect(() => {
    const routePaymentUrl = (url: string) => {
      const parsed = Linking.parse(url)
      const path = parsed.path ?? ''
      if (!path.startsWith('payment/')) return
      const params: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed.queryParams ?? {})) {
        if (typeof v === 'string' && v.length > 0) params[k] = v
        else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') params[k] = v[0]
      }
      router.replace({ pathname: ('/' + path) as never, params })
    }

    const sub = Linking.addEventListener('url', (event) => routePaymentUrl(event.url))
    Linking.getInitialURL().then((url) => {
      if (url) routePaymentUrl(url)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    trackHomepageView()
  }, [])

  useEffect(() => {
    const detach = attachNotificationTapHandler()
    return () => detach()
  }, [])

  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  useEffect(() => {
    getSiteSettings()
      .then(setSiteSettings)
      .catch(() => {})
  }, [])

  if (!fontsLoaded && !fontError) return null

  const tree = (
    <SafeAreaProvider style={{ backgroundColor: '#1A2540' }}>
      <LocaleProvider>
        <AuthProvider>
          <LoginGateProvider>
            <StatusBar style="auto" />
            <RootStack />
            <UpdatePrompt settings={siteSettings} />
            <StoreShareDialogTrigger />
          </LoginGateProvider>
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  )

  return __DEV__ ? <ErrorBoundary>{tree}</ErrorBoundary> : tree
}

// Nested so useLocale() can see LocaleProvider. `contentStyle.direction` sets
// direction on each screen's native content root — this is the surface Yoga
// actually mirrors from, since react-native-screens creates a fresh native
// container per screen that doesn't inherit direction from React parents.
// `key={locale}` re-mounts the whole nav on language change.
function RootStack() {
  const { locale, isRtl } = useLocale()
  return (
    <Stack
      key={locale}
      screenOptions={{
        headerShown: false,
        contentStyle: { direction: isRtl ? 'rtl' : 'ltr', backgroundColor: '#1A2540' },
      }}
    />
  )
}
