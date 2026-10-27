import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'

const ONBOARDED_KEY = 'vatix_onboarded'

export default function Index() {
  const { loading } = useAuth()
  const { colors } = useTheme()
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDED_KEY).then(v => setOnboarded(v === '1'))
  }, [])

  if (loading || onboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.y} size="large" />
      </View>
    )
  }

  if (!onboarded) {
    return <Redirect href="/(onboarding)/welcome" />
  }

  return <Redirect href="/(tabs)/home" />
}
