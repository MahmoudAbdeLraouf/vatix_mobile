import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { router } from 'expo-router'
import {
  authFetch,
  clearSession,
  getStoredUser,
  isLoggedIn,
  saveSession,
  startTokenRefresher,
  StoredUser,
  updateStoredDisplayName,
  updateStoredUser,
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

  // An admin can turn a client into a store while the app is open (store
  // application approved, subscription confirmed). Re-read the type on launch
  // and on every foreground so the store UI appears without a re-login.
  const isClient = user?.type === 'client'
  useEffect(() => {
    if (!isClient) return
    const sync = async () => {
      try {
        const profile = await authFetch<{ type?: string }>('/user/profile')
        if (!profile?.type || profile.type === 'client') return
        await updateStoredUser(profile)
        setUser(await getStoredUser())
      } catch {
        // Offline or token trouble — the next foreground retries.
      }
    }
    void sync()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync()
    })
    return () => sub.remove()
  }, [isClient])

  const login = useCallback(async (response: AuthResponse, redirect?: string) => {
    await saveSession(response.accessToken, response.refreshToken, response.user)
    const stored = await getStoredUser()
    setUser(stored)
    startTokenRefresher()
    registerForPushNotifications().catch(() => {})
    router.replace(resolveRedirect(redirect) as never)
  }, [])

  const logout = useCallback(async () => {
    await unregisterPushNotifications()
    await clearSession()
    setUser(null)
    router.replace('/(auth)/login')
  }, [])

  const updateDisplayName = useCallback(async (name: string) => {
    await updateStoredDisplayName(name)
    const stored = await getStoredUser()
    setUser(stored)
  }, [])

  const refetchUser = useCallback(async () => {
    const stored = await getStoredUser()
    setUser(stored)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      updateDisplayName,
      refetchUser,
    }),
    [user, loading, login, logout, updateDisplayName, refetchUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
