import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { darkColors, lightColors, type ThemeColors } from '@/constants/theme'

const THEME_KEY = 'vatix_theme'

export type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  isDark: boolean
  colors: ThemeColors
  setMode: (mode: ThemeMode) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Manual toggle only. Following the phone's system setting needs
// `userInterfaceStyle: "automatic"` in app.json (a native change), so until a
// store build ships with it useColorScheme() always reports light.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then(saved => setModeState(saved === 'dark' ? 'dark' : 'light'))
      .catch(() => setModeState('light'))
  }, [])

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m)
    await SecureStore.setItemAsync(THEME_KEY, m).catch(() => {})
  }, [])

  const value = useMemo<ThemeContextValue>(() => {
    const m = mode ?? 'light'
    return { mode: m, isDark: m === 'dark', colors: m === 'dark' ? darkColors : lightColors, setMode }
  }, [mode, setMode])

  if (mode === null) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
