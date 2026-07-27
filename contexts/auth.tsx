import React, { createContext, useContext, useEffect, useState } from 'react'
import { router } from 'expo-router'
import {
  clearSession,
  getStoredUser,
  isLoggedIn,
  saveSession,
  startTokenRefresher,
  StoredUser,
  updateStoredDisplayName,
} from '@/lib/auth'
import { AuthResponse } from '@/lib/api'
import { registerForPushNotifications, unregisterPushNotifications } from '@/lib/notifications'

interface AuthContextValue {
  user: StoredUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (response: AuthResponse, redirect?: string) => Promise<void>
  logout: () => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
  refetchUser: () => Promise<void>
}

function resolveRedirect(redirect?: string): string {
  if (!redirect) return '/(tabs)/home'
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return '/(tabs)/home'
  if (redirect.startsWith('/(auth)')) return '/(tabs)/home'
  return redirect
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stopRefresher: (() => void) | null = null

    async function init() {
      try {
        const loggedIn = await isLoggedIn()
        if (!loggedIn) return

        const stored = await getStoredUser()
        if (!stored) {
          // Tokens present but the cached user blob is missing or shape-drifted
          // from an older app install. Clearing the session forces a clean
          // re-login rather than rendering with a malformed user object.
          await clearSession()
          return
        }
        setUser(stored)
        stopRefresher = startTokenRefresher()
        registerForPushNotifications().catch(() => {})
      } finally {
        setLoading(false)
      }
    }

    init()
    return () => {
      stopRefresher?.()
    }
  }, [])

  async function login(response: AuthResponse, redirect?: string) {
    await saveSession(response.accessToken, response.refreshToken, response.user)
    const stored = await getStoredUser()
    setUser(stored)
    startTokenRefresher()
    registerForPushNotifications().catch(() => {})
    router.replace(resolveRedirect(redirect) as never)
  }

  async function logout() {
    await unregisterPushNotifications()
    await clearSession()
    setUser(null)
    router.replace('/(auth)/login')
  }

  async function updateDisplayName(name: string) {
    await updateStoredDisplayName(name)
    const stored = await getStoredUser()
    setUser(stored)
  }

  async function refetchUser() {
    const stored = await getStoredUser()
    setUser(stored)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        updateDisplayName,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
