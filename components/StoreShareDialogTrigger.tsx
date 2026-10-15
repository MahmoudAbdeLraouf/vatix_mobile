import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { authFetch } from '@/lib/auth'
import type { UserProfile } from '@/lib/api'
import { StoreShareDialog } from './StoreShareDialog'

export function StoreShareDialogTrigger() {
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user?.isStore) return

    let cancelled = false
    authFetch<UserProfile>('/user/profile').then(p => {
      if (cancelled) return
      // The backend tracks "seen" in user_actions and exposes it via flags;
      // the old storeShareDialogSeenAt column no longer exists.
      if (p?.storeProfile && p.flags?.showStoreShareDialog) {
        setProfile(p)
        setOpen(true)
      }
    }).catch(() => {})

    return () => { cancelled = true }
  }, [loading, user?.isStore])

  if (!open || !profile?.storeProfile) return null

  return (
    <StoreShareDialog
      visible={open}
      storeId={profile.id}
      storeSlug={profile.storeProfile.slug ?? null}
      storeName={profile.storeProfile.name}
      onClose={() => setOpen(false)}
    />
  )
}
