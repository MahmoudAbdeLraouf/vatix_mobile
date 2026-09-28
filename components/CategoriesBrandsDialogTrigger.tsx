import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { authFetch } from '@/lib/auth'
import type { UserProfile } from '@/lib/api'
import { CategoriesBrandsDialog } from './CategoriesBrandsDialog'

export function CategoriesBrandsDialogTrigger() {
  const { isAuthenticated, loading } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) return

    let cancelled = false
    authFetch<UserProfile>('/user/profile')
      .then((p) => {
        if (cancelled) return
        if (p?.flags?.showStoreCategoriesBrandsDialog) {
          setOpen(true)
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [loading, isAuthenticated])

  if (!open) return null

  return (
    <CategoriesBrandsDialog
      visible={open}
      onClose={() => setOpen(false)}
    />
  )
}
