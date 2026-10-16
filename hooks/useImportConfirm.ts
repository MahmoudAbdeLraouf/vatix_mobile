import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { authErrorMessage } from '@/lib/auth'
import { buySlotsForImportHref, type ImportScreen } from '@/components/import/ClientCapCard'
import { ImportApiError, type ImportConfirmResult } from '@/lib/import'
import type { Translations } from '@/lib/i18n'

/** Readable text for any import failure; `fallback` covers empty backend messages. */
export function describeImportError(err: unknown, t: Translations, fallback: string): string {
  const ip = t.importProducts
  if (err instanceof ImportApiError) {
    if (err.status === 429) return ip.rateLimited.replace('{seconds}', String(err.retryAfter ?? 2))
    return err.message || fallback
  }
  return authErrorMessage(err, t) || fallback
}

/**
 * Wraps a confirm call shared by the Shopify, EasyOrders and Excel screens:
 * busy flag, listing-cap prompt (buy slots, then resume this screen), row-specific category/brand errors, and the
 * success alert that lands on My Ads.
 */
export function useImportConfirm(screen: ImportScreen) {
  const { t } = useLocale()
  const ip = t.importProducts
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const run = useCallback(
    async (confirm: () => Promise<ImportConfirmResult>) => {
      if (inFlight.current) return
      inFlight.current = true
      setBusy(true)
      setError(null)
      try {
        const res = await confirm()
        const count = res?.createdIds?.length ?? 0
        const skipped = res?.skippedExisting ?? 0
        const body = ip.importedBody.replace('{count}', String(count))
        Alert.alert(
          ip.importedTitle,
          skipped > 0 ? `${body}\n${ip.skippedExisting.replace('{n}', String(skipped))}` : body,
          [{ text: ip.ok, onPress: () => router.replace('/dashboard/my-ads') }],
          { cancelable: false },
        )
      } catch (err) {
        if (err instanceof ImportApiError) {
          if (err.code === 'CLIENT_PRODUCT_CAP_REACHED') {
            const msg =
              err.cap != null ? ip.capReachedError.replace('{cap}', String(err.cap)) : ip.capReached
            setError(msg)
            Alert.alert(ip.capTitle, msg, [
              { text: ip.ok, style: 'cancel' },
              { text: ip.capBuySlots, onPress: () => router.push(buySlotsForImportHref(screen) as never) },
            ])
            return
          }
          if (err.code === 'CATEGORY_NOT_FOUND' && err.rowNumber != null) {
            setError(ip.categoryNotFound.replace('{row}', String(err.rowNumber)))
            return
          }
          if (err.code === 'BRAND_NOT_FOUND' && err.rowNumber != null) {
            setError(ip.brandNotFound.replace('{row}', String(err.rowNumber)))
            return
          }
        }
        setError(describeImportError(err, t, ip.saveFailed))
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [ip, t, screen],
  )

  return { busy, error, setError, run }
}
