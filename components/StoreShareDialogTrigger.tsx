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
    console.log('[ShareDialog] effect fired', { loading, isStore: user?.isStore, userType: user?.type })
    if (loading) return
    if (!user?.isStore) return

    let cancelled = false
    authFetch<UserProfile>('/user/profile').then(p => {
      console.log('[ShareDialog] profile response', {
        hasProfile: !!p,
        hasStoreProfile: !!p?.storeProfile,
        seenAt: p?.storeShareDialogSeenAt,
      })
      if (cancelled) return
      if (p && p.storeProfile && p.storeShareDialogSeenAt == null) {
        setProfile(p)
        setOpen(true)
      }
    }).catch((e) => { console.log('[ShareDialog] fetch error', e) })

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
