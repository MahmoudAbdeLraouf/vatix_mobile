import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { isLoggedIn } from '@/lib/auth'
import { listMyBroOffers, type MyOfferCounts } from '@/lib/bro'

/** Sent-offer totals for entry points into /bro/offers; refetched on focus. `null` until loaded or when signed out. */
export function useMyOfferCounts(enabled: boolean): MyOfferCounts | null {
  const [counts, setCounts] = useState<MyOfferCounts | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setCounts(null)
        return
      }
      let live = true
      ;(async () => {
        if (!(await isLoggedIn())) {
          if (live) setCounts(null)
          return
        }
        const res = await listMyBroOffers(1)
        if (!live || !res) return
        setCounts(
          res.counts ?? {
            all: res.total,
            active: res.items.filter(o => o.state === 'active').length,
            connected: res.items.filter(o => !!o.buyerConnectedAt).length,
            closed: res.items.filter(o => o.state !== 'active').length,
          },
        )
      })().catch(() => {})
      return () => {
        live = false
      }
    }, [enabled]),
  )

  return counts
}
