import { useEffect } from 'react'
import { router } from 'expo-router'

export default function PromotionsScreen() {
  useEffect(() => {
    router.replace('/dashboard/promote')
  }, [])
  return null
}
