import { Redirect, useLocalSearchParams } from 'expo-router'

// Old sign-up route (deep links, older in-app links) — registration is one client form now.
export default function LegacySignupRedirect() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  return <Redirect href={redirect ? { pathname: '/(auth)/register', params: { redirect } } : '/(auth)/register'} />
}
