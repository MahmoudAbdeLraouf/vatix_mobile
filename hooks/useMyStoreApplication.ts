// Shared view of the client's store application, so every "convert to a store"
// pitch can show the application status instead once the user has applied.
// One request per user, deduped across mounts; refetched when a screen regains focus.
import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { getMyStoreApplication, type MyStoreApplication } from '@/lib/storeApplication'

let state: { key: string; app: MyStoreApplication | null; loaded: boolean } | null = null
let inflight: { key: string; promise: Promise<void> } | null = null
const listeners = new Set<() => void>()

function load(key: string): Promise<void> {
  if (inflight?.key === key) return inflight.promise
  const promise = getMyStoreApplication()
    .then(
      (app) => {
        state = { key, app: app ?? null, loaded: true }
      },
      () => {
        // Keep the last known value; a first-load failure counts as "no application".
        if (state?.key !== key) state = { key, app: null, loaded: true }
      },
    )
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
      listeners.forEach((l) => l())
    })
  inflight = { key, promise }
  return promise
}

/** Force a refetch (e.g. after submitting or resubmitting the application). */
export function refreshMyStoreApplication() {
  if (state) void load(state.key)
}

export function useMyStoreApplication() {
  const { user } = useAuth()
  const key = user && !user.isStore ? String(user.id) : null
  const [, rerender] = useState(0)

  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (key) void load(key)
    }, [key]),
  )

  const current = key && state?.key === key ? state : null
  const app = current?.app ?? null
  return {
    app,
    /** False until the first response, so pitches don't flash then swap. */
    loaded: !key || !!current?.loaded,
    /** Applied and not yet approved: show the status, not "convert to a store". */
    open: !!app && app.status !== 'approved',
  }
}
