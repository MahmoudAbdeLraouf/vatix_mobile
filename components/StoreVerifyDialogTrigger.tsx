import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { authFetch, markActionSeen } from '@/lib/auth'
import type { UserProfile } from '@/lib/api'
import { StoreVerifyDialog } from './StoreVerifyDialog'

export function StoreVerifyDialogTrigger() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user?.isStore) return
    if (checkedRef.current) return
    // Don't interrupt a store that is already on the verify screen.
    if (pathname?.startsWith('/dashboard/verify')) return

    let cancelled = false
    checkedRef.current = true
    authFetch<UserProfile>('/user/profile')
      .then((p) => {
        if (cancelled) return
        if (p?.flags?.showStoreVerifyDialog) {
          setOpen(true)
          // Each show counts toward the repeat cap.
          markActionSeen('store_verify_dialog')
        }
      })
      .catch(() => { checkedRef.current = false })

    return () => { cancelled = true }
  }, [loading, user?.isStore, pathname])

  if (!open) return null

  return (
    <StoreVerifyDialog
      visible={open}
      onClose={() => setOpen(false)}
    />
  )
}
