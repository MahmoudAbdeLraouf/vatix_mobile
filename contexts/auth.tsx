import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { router } from 'expo-router'
import {
  authFetch,
  clearSession,
  getStoredUser,
  isLoggedIn,
  normalizeUserType,
  refreshAccessToken,
  registerSessionHooks,
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
  // Mirrors `user` for the session-cleared listener, which outlives renders.
  const userRef = useRef<StoredUser | null>(null)
  userRef.current = user
  const stopRefresherRef = useRef<(() => void) | null>(null)
  const loggingOutRef = useRef(false)

  // The session was wiped outside an explicit logout: the refresh token was
  // rejected (expired, revoked, account disabled) or a request found no
  // session. Drop the signed-in UI and send the user to login instead of
  // leaving screens showing "session expired" errors.
  useEffect(() => {
    return registerSessionHooks({
      onSessionCleared: () => {
        stopRefresherRef.current?.()
        stopRefresherRef.current = null
        // Guests and the explicit logout (which navigates itself) don't redirect.
        if (!userRef.current || loggingOutRef.current) return
        userRef.current = null
        setUser(null)
        router.replace('/(auth)/login')
      },
    })
  }, [])

  useEffect(() => {

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
        stopRefresherRef.current = startTokenRefresher()
        registerForPushNotifications().catch(() => {})
      } finally {
        setLoading(false)
      }
    }

    init()
    return () => {
      stopRefresherRef.current?.()
      stopRefresherRef.current = null
    }
  }, [])

  // The account type can change outside this screen (store application
  // approved, admin downgrade, a downgrade from another device). Re-read it on
  // launch and on every foreground so the UI matches without a re-login.
  const storedType = user?.type === 'client' || user?.type === 'store' ? user.type : null
  useEffect(() => {
    if (!storedType) return
    const sync = async () => {
      try {
        const profile = await authFetch<{ type?: string }>('/user/profile')
        if (!profile?.type || normalizeUserType(profile.type) === storedType) return
        await updateStoredUser(profile)
        await refreshAccessToken()
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
  }, [storedType])

  const login = useCallback(async (response: AuthResponse, redirect?: string) => {
    await saveSession(response.accessToken, response.refreshToken, response.user)
    const stored = await getStoredUser()
    setUser(stored)
    stopRefresherRef.current = startTokenRefresher()
    registerForPushNotifications().catch(() => {})
    router.replace(resolveRedirect(redirect) as never)
  }, [])

  const logout = useCallback(async () => {
    // Set first so the session-cleared listener leaves navigation to us.
    loggingOutRef.current = true
    try {
      await unregisterPushNotifications()
      await clearSession()
      setUser(null)
      router.replace('/(auth)/login')
    } finally {
      loggingOutRef.current = false
    }
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
