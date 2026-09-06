import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { Locale, Translations, translations } from '@/lib/i18n'
import { applyTextDirectionDefaults } from '@/lib/rtl'

const LOCALE_KEY = 'vatix_locale'
const DEFAULT_LOCALE: Locale = 'ar'

// Seed defaults synchronously at module load with the assumed default locale.
// If SecureStore returns a different value, LocaleProvider re-applies defaults
// AND re-mounts the tree via `key` so every Text picks up the new baseline.
applyTextDirectionDefaults(DEFAULT_LOCALE === 'ar')

interface LocaleContextValue {
  locale: Locale
  t: Translations
  isRtl: boolean
  setLocale: (locale: Locale) => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(LOCALE_KEY).then(saved => {
      const l = (saved as Locale | null) ?? DEFAULT_LOCALE
      applyTextDirectionDefaults(l === 'ar')
      setLocaleState(l)
    })
  }, [])

  const setLocale = useCallback(async (l: Locale) => {
    await SecureStore.setItemAsync(LOCALE_KEY, l)
    applyTextDirectionDefaults(l === 'ar')
    setLocaleState(l)
  }, [])

  const isRtl = locale === 'ar'

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: locale as Locale,
      t: translations[(locale ?? DEFAULT_LOCALE) as Locale],
      isRtl,
      setLocale,
    }),
    [locale, isRtl, setLocale],
  )

  if (locale === null) return null

  // Setting `direction: rtl` on this root View propagates through the Yoga
  // layout tree: flexDirection:'row' children mirror, and start/end resolve
  // correctly. This does NOT rely on I18nManager.forceRTL — which is
  // effectively unusable in Expo Go, since the Expo Go binary always launches
  // LTR regardless of what forceRTL wrote to native defaults.
  //
  // The `key={locale}` prop forces a full re-mount when the user switches
  // language so Text.defaultProps changes actually flow into the tree.
  return (
    <LocaleContext.Provider value={value}>
      <View key={locale} style={{ flex: 1, direction: isRtl ? 'rtl' : 'ltr' }}>
        {children}
      </View>
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
