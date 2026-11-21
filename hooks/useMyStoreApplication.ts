// Shared view of the client's store application, so every "convert to a store"
// pitch can show the application status instead once the user has applied.
// One request per user, deduped across mounts; refetched when a screen regains focus.
import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { getStoredUser } from '@/lib/auth'
import { getMyStoreApplication, type MyStoreApplication } from '@/lib/storeApplication'

let state: { key: string; app: MyStoreApplication | null; loaded: boolean; failed?: boolean } | null = null
let inflight: { key: string; promise: Promise<void> } | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())

function load(key: string): Promise<void> {
  if (inflight?.key === key) return inflight.promise
  const promise = getMyStoreApplication()
    .then(
      (app) => {
        if (inflight?.promise !== promise) return // superseded by a forced refresh
        state = { key, app: app ?? null, loaded: true }
      },
      () => {
        if (inflight?.promise !== promise) return
        // Keep the last known value; a first-load failure counts as "no application"
        // until the next focus retries it.
        state =
          state?.key === key && !state.failed
            ? { ...state, loaded: true }
            : { key, app: null, loaded: true, failed: true }
      },
    )
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
      notify()
    })
  inflight = { key, promise }
  return promise
}

/** Force a refetch (e.g. right after signing up as a store or submitting the
 *  application). Pitches wait for the fresh answer instead of showing the stale
 *  "no application" one in the meantime. */
export function refreshMyStoreApplication() {
  const run = (key: string) => {
    state = { key, app: state?.key === key ? state.app : null, loaded: false }
    notify()
    inflight = null
    void load(key)
  }
  if (state) return run(state.key)
  void getStoredUser().then((u) => {
    if (u && !u.isStore) run(String(u.id))
  })
}

/** Non-hook read of the cached status, for plain helpers (e.g. error mappers). */
export function isMyStoreApplicationOpen(): boolean {
  const app = state?.app
  return !!app && app.status !== 'approved'
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
