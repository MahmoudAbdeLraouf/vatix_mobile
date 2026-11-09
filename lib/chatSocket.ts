import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { io, type Socket } from 'socket.io-client'
import {
  getRefreshToken,
  getToken,
  isLoggedIn,
  refreshAccessToken,
  registerSessionHooks,
} from '@/lib/auth'
import type { ChatEventMap } from '@/lib/chat/types'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'

/** Socket must be down longer than this before polling kicks in. */
export const FALLBACK_AFTER_MS = 10_000
/** Give up re-authenticating after this many consecutive rejections. */
const MAX_AUTH_RETRIES = 5
const AUTH_RETRY_DELAY_MS = 3000

let socket: Socket | null = null
/** True once a session check found tokens; false after logout. Gates polling. */
let sessionActive = false
/** App is in the background: the socket is closed on purpose and must stay closed. */
let backgrounded = AppState.currentState === 'background'
let downSince: number | null = null
let authRetries = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let lastDowntimeMs = 0
const statusListeners = new Set<() => void>()
/** Every mounted `useFallbackPoll` callback; each is run once when the app returns to the foreground. */
const pollCallbacks = new Set<{ current: () => void }>()

let connectedSnapshot = false

function notifyStatus() {
  connectedSnapshot = !!socket?.connected
  statusListeners.forEach((l) => l())
}

/**
 * The server drops a socket whose access token has expired, and rejects handshakes with a stale one;
 * neither case auto-reconnects in socket.io, so refresh the token and connect again (bounded).
 */
function scheduleReauth() {
  if (retryTimer || authRetries >= MAX_AUTH_RETRIES || backgrounded) return
  authRetries += 1
  retryTimer = setTimeout(async () => {
    retryTimer = null
    if (!socket || socket.connected || backgrounded || !sessionActive) return
    if (!(await getRefreshToken())) return
    await refreshAccessToken()
    if (socket && !socket.connected && !backgrounded && (await getToken())) socket.connect()
  }, AUTH_RETRY_DELAY_MS)
}

function createSocket(): Socket {
  const s = io(`${BASE}/chat`, {
    transports: ['websocket'],
    // Callback form: every (re)connect reads the current token, so a refreshed one is used.
    // If only the refresh token is left (access token gone), refresh first, then connect.
    auth: (cb) => {
      void (async () => {
        let token = await getToken()
        if (!token && (await getRefreshToken())) {
          await refreshAccessToken()
          token = await getToken()
        }
        cb({ token })
      })()
    },
  })

  s.on('connect', () => {
    lastDowntimeMs = downSince ? Date.now() - downSince : 0
    downSince = null
    authRetries = 0
    notifyStatus()
  })
  s.on('disconnect', (reason) => {
    // 'io client disconnect' is us (background / logout): that is not downtime.
    if (reason !== 'io client disconnect' && sessionActive) downSince ??= Date.now()
    notifyStatus()
    if (reason === 'io server disconnect') scheduleReauth()
  })
  s.on('connect_error', () => {
    if (sessionActive) downSince ??= Date.now()
    notifyStatus()
    if (!s.active) scheduleReauth()
  })
  return s
}

/**
 * Check the stored session and, if there is one, create / (re)connect the shared socket.
 * Safe to call repeatedly; does nothing in the background or when logged out.
 */
async function ensureSocket(): Promise<void> {
  const active = await isLoggedIn()
  sessionActive = active
  if (!active || backgrounded) return
  const created = !socket
  socket ??= createSocket()
  if (!socket.connected && !socket.active) {
    downSince ??= Date.now()
    socket.connect()
  }
  if (created) notifyStatus()
}

// Registered at module load (not on socket creation) so a login after mount can start the socket.
registerSessionHooks({
  // A fresh access token is stored: cycle a live connection so the server-side expiry timer restarts.
  // A connection still being established reads the new token itself, so it is left alone.
  onTokenRefreshed: () => {
    if (socket?.connected && !backgrounded) socket.disconnect().connect()
  },
  // Tokens written (login or refresh): create / reconnect the socket if a mounted hook is waiting.
  onTokensSaved: () => {
    if (socket || statusListeners.size > 0) void ensureSocket()
  },
  onSessionCleared: () => {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    authRetries = 0
    sessionActive = false
    if (socket) socket.disconnect()
    // After the disconnect handler ran: a logged-out client is not "down", so polling must stop.
    downSince = null
    lastDowntimeMs = 0
    notifyStatus()
  },
})

// Background: close the socket (iOS kills it anyway; Android would burn battery).
// Foreground: reconnect and run every poll callback once, to catch up on what was missed.
AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    backgrounded = true
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    downSince = null
    socket?.disconnect()
    notifyStatus()
  } else if (state === 'active' && backgrounded) {
    backgrounded = false
    authRetries = 0
    void ensureSocket()
    pollCallbacks.forEach((cb) => cb.current())
  }
})

/**
 * Shared `/chat` socket. Returns null until a session exists (the socket is created lazily once a
 * token appears, including after a late login) — mounted hooks re-render when it does.
 * The instance is a singleton, so listeners stay valid across logout/login.
 * Note: the server forgets `presence:` room joins on reconnect, so re-emit `presence:watch`
 * on every 'connect'.
 */
export function getChatSocket(): Socket | null {
  void ensureSocket()
  return socket
}

/** The current socket instance (null until created); re-renders subscribers when it appears. */
function useSocketInstance(): Socket | null {
  const s = useSyncExternalStore(subscribeStatus, () => socket, () => null)
  // Create it (outside render) as soon as a session exists; creation notifies subscribers.
  useEffect(() => { void ensureSocket() }, [])
  return s
}

/** Subscribe to server -> client chat events. Handlers may change every render. */
export function useChatEvents(handlers: Partial<{ [K in keyof ChatEventMap]: (payload: ChatEventMap[K]) => void }>) {
  const ref = useRef(handlers)
  useEffect(() => { ref.current = handlers })
  const s = useSocketInstance()

  useEffect(() => {
    if (!s) return
    const names = ['message:new', 'conversation:updated', 'unread:count', 'typing', 'presence'] as const
    const bound = names.map((name) => {
      const fn = (payload: unknown) => {
        const h = ref.current[name] as ((p: unknown) => void) | undefined
        h?.(payload)
      }
      s.on(name, fn)
      return [name, fn] as const
    })
    return () => { bound.forEach(([name, fn]) => s.off(name, fn)) }
  }, [s])
}

function currentDownMs(): number {
  return downSince ? Date.now() - downSince : 0
}

function subscribeStatus(cb: () => void) {
  statusListeners.add(cb)
  return () => { statusListeners.delete(cb) }
}

/** Connection state; `downForMs` ticks once a second while disconnected. */
export function useSocketStatus(): { connected: boolean; downForMs: number } {
  useSocketInstance()
  const connected = useSyncExternalStore(subscribeStatus, () => connectedSnapshot, () => false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (connected) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [connected])

  return { connected, downForMs: connected || !downSince ? 0 : Math.max(0, now - downSince) }
}

/**
 * Polling fallback: runs `fn` every `everyMs` while the socket has been down for more than 10 s,
 * once on each reconnect (catch-up), and once when the app returns to the foreground.
 * No polling while the socket is healthy, the app is backgrounded, or the user is logged out.
 */
export function useFallbackPoll(fn: () => void, everyMs: number) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  const s = useSocketInstance()

  useEffect(() => {
    pollCallbacks.add(ref)
    return () => { pollCallbacks.delete(ref) }
  }, [])

  useEffect(() => {
    const startedAt = Date.now()
    let hadConnection = !!s?.connected
    const onConnect = () => {
      // A reconnect, or a first connect that took long enough that polling had started.
      if (hadConnection || lastDowntimeMs > FALLBACK_AFTER_MS) ref.current()
      hadConnection = true
    }
    s?.on('connect', onConnect)
    const timer = setInterval(() => {
      if (!sessionActive || backgrounded) return // logged out / suspended: nothing to poll for
      // No socket yet (should be transient) counts as down since this effect started.
      const down = s ? !s.connected && currentDownMs() > FALLBACK_AFTER_MS : Date.now() - startedAt > FALLBACK_AFTER_MS
      if (down) ref.current()
    }, everyMs)
    return () => { s?.off('connect', onConnect); clearInterval(timer) }
  }, [s, everyMs])
}
