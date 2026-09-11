import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { authFetch } from '@/lib/auth'
import { PROMOTION_UI_ENABLED } from '@/lib/platform'
import type { UserProfile } from '@/lib/api'
import { UsePromoCreditsDialog } from './UsePromoCreditsDialog'

export function UsePromoCreditsDialogTrigger() {
  const { isAuthenticated, loading } = useAuth()
  const [credits, setCredits] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!PROMOTION_UI_ENABLED) return
    if (loading) return
    if (!isAuthenticated) return

    let cancelled = false
    authFetch<UserProfile>('/user/profile')
      .then((p) => {
        if (cancelled) return
        if (p?.flags?.showUsePromoCreditsDialog) {
          setCredits(p.flags.promoCreditsBalance ?? 0)
          setOpen(true)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [loading, isAuthenticated])

  if (!open || credits === null) return null

  return (
    <UsePromoCreditsDialog
      visible={open}
      onClose={() => setOpen(false)}
      credits={credits}
    />
  )
}
