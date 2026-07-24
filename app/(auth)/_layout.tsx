import { Stack } from 'expo-router'
import { useLocale } from '@/contexts/locale'

export default function AuthLayout() {
  const { locale, isRtl } = useLocale()
  return (
    <Stack
      key={locale}
      screenOptions={{
        headerShown: false,
        contentStyle: { direction: isRtl ? 'rtl' : 'ltr' },
      }}
    />
  )
}
