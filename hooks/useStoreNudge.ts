// Shared "is this client acting like a store?" signal behind the convert-to-store
// cards. One request per user, deduped across mounts. Works at the root layout:
// loads on login, on app foreground and on route changes once the answer is stale.
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { usePathname } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { getStoredUser } from '@/lib/auth'
import { getStoreNudge, type StoreNudge } from '@/lib/storeApplication'

const STALE_MS = 60_000

let state: { key: string; nudge: StoreNudge | null; loaded: boolean; at: number } | null = null
let inflight: { key: string; promise: Promise<void> } | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())

function load(key: string): Promise<void> {
  if (inflight?.key === key) return inflight.promise
  const promise = getStoreNudge()
    .then(
      (nudge) => {
        if (inflight?.promise !== promise) return
        state = { key, nudge: nudge ?? null, loaded: true, at: Date.now() }
      },
      () => {
        if (inflight?.promise !== promise) return
        // Keep the last answer; with none, stay quiet until the next retry.
        state = { key, nudge: state?.key === key ? state.nudge : null, loaded: true, at: Date.now() }
      },
    )
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
      notify()
    })
  inflight = { key, promise }
  return promise
}

/** Refetch after the client lists a product or sends a Bro offer. */
export function refreshStoreNudge() {
  const run = (key: string) => {
    inflight = null
    void load(key)
  }
  if (state) return run(state.key)
  void getStoredUser().then((u) => {
    if (u && !u.isStore) run(String(u.id))
  })
}

export function useStoreNudge() {
  const { user } = useAuth()
  const key = user && !user.isStore ? String(user.id) : null
  const pathname = usePathname()
  const [, rerender] = useState(0)

  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  useEffect(() => {
    if (!key) {
      state = null
      inflight = null
      return
    }
    if (state?.key !== key) void load(key)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load(key)
    })
    return () => sub.remove()
  }, [key])

  useEffect(() => {
    if (key && state?.key === key && Date.now() - state.at > STALE_MS) void load(key)
  }, [key, pathname])

  const current = key && state?.key === key ? state : null
  return { nudge: current?.nudge ?? null, isClient: !!key, loaded: !!current?.loaded }
}
