import { Redirect } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { ActivityIndicator, View } from 'react-native'
import { colors } from '@/constants/theme'

export default function Index() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.y} size="large" />
      </View>
    )
  }

  return <Redirect href="/(tabs)/home" />
}
