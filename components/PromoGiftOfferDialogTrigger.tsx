import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { authFetch, markActionSeen } from '@/lib/auth'
import type { UserProfile } from '@/lib/api'
import { PROMOTION_UI_ENABLED } from '@/lib/platform'
import { PromoGiftOfferDialog } from './PromoGiftOfferDialog'

type Offer = NonNullable<UserProfile['promoGiftOffer']>

export function PromoGiftOfferDialogTrigger() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [offer, setOffer] = useState<Offer | null>(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (!PROMOTION_UI_ENABLED) return
    if (loading) return
    if (!user?.isStore) return
    if (checkedRef.current) return
    // Don't interrupt a store that is already adding a product.
    if (pathname?.startsWith('/products/new')) return

    let cancelled = false
    checkedRef.current = true
    authFetch<UserProfile>('/user/profile')
      .then((p) => {
        if (cancelled) return
        if (p?.flags?.showPromoGiftOfferDialog && p.promoGiftOffer) {
          setOffer(p.promoGiftOffer)
          // Each show counts toward the repeat cap.
          markActionSeen('promo_gift_offer_dialog')
        }
      })
      .catch(() => { checkedRef.current = false })

    return () => { cancelled = true }
  }, [loading, user?.isStore, pathname])

  if (!PROMOTION_UI_ENABLED) return null
  if (!offer) return null

  return <PromoGiftOfferDialog offer={offer} onClose={() => setOffer(null)} />
}
