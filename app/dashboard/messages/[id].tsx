import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as StoreReview from 'expo-store-review'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ErrorState } from '@/components/ui/ErrorState'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { getSiteSettings, imgUrl, type SiteSettings } from '@/lib/api'
import { authFetch, authPatch, authPost } from '@/lib/auth'
import { BroAvatar, BroBadge } from '@/components/bro/BroAvatar'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { Composer } from '@/components/chat/Composer'
import { QuickReplies } from '@/components/chat/QuickReplies'
import { getChatSocket, useChatEvents, useFallbackPoll, useSocketStatus } from '@/lib/chatSocket'
import { mergeMessages } from '@/lib/chat/merge'
import { shouldShowChips } from '@/lib/chat/rules'
import {
  DEFAULT_QUICK_REPLIES,
  firstServerId,
  lastServerId,
  makeTextDraft,
  resolveQuickReplies,
  setLocalState,
  uuidv4,
} from '@/lib/chat/thread'
import type { ChatConversation, ChatMessage, LocalMessage, QuickReply, TypingKind } from '@/lib/chat/types'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

const PAGE_SIZE = 30
/** Socket-down fallback cadence (the socket carries live traffic; no polling while it is up). */
const FALLBACK_POLL_MS = 15_000
const READ_DEBOUNCE_MS = 1_000
/** Re-send `typing on` this often while keystrokes continue (server throttles to 2 s). */
const TYPING_RESEND_MS = 3_000
/** Stop advertising typing after this long without a keystroke. */
const TYPING_IDLE_MS = 5_000
/** Drop the peer's typing line if no refresh/stop arrives (lost `on:false`). */
const PEER_TYPING_TTL_MS = 6_000
/** Bound on forward pages fetched per catch-up. */
const CATCH_UP_MAX_PAGES = 5

type ThreadPage = { conversation: ChatConversation; messages: ChatMessage[]; hasMore: boolean }

function dateLabel(iso: string, ar: boolean): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  if (sameDay) return ar ? 'اليوم' : 'Today'
  if (isYesterday) return ar ? 'الأمس' : 'Yesterday'
  const locale = ar ? 'ar-EG' : 'en-US'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

type Row =
  | { kind: 'separator'; id: string; label: string }
  | { kind: 'message'; id: string; message: LocalMessage }

export default function ConversationScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  // LocaleProvider applies `direction: 'rtl'` at the tree root. Under inherited
  // RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve visually
  // BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so the first
  // child anchors to the physical right. `colDir` restores RTL context inside
  // those rows so nested text uses `textAlign: 'auto'` = start alignment.
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const colDir = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const { user } = useAuth()
  const me = user?.id ?? 0
  const { id } = useLocalSearchParams<{ id: string }>()
  const conversationId = Number(id) || 0
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  // Focus via expo-router (no direct @react-navigation import): true while this screen is on top.
  const [isFocused, setIsFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true)
      return () => setIsFocused(false)
    }, []),
  )
  const { connected } = useSocketStatus()

  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [text, setText] = useState('')
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(DEFAULT_QUICK_REPLIES)
  const [otherTyping, setOtherTyping] = useState<TypingKind | null>(null)
  const [online, setOnline] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  const listRef = useRef<FlatList<Row>>(null)
  const composerRef = useRef<TextInput>(null)
  const scrollYRef = useRef(0)
  const messagesRef = useRef<LocalMessage[]>([])
  const tempIdRef = useRef(-1)
  const loadingOlderRef = useRef(false)
  const catchingUpRef = useRef(false)
  const settingsRef = useRef<SiteSettings | null>(null)
  const focusedRef = useRef(isFocused)
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingOnRef = useRef(false)
  const lastTypingEmitRef = useRef(0)
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { focusedRef.current = isFocused }, [isFocused])

  const other = conversation?.otherUser ?? null
  const otherId = other?.id ?? 0
  const otherIsBro = other?.isBro ?? false

  // ── Read state ────────────────────────────────────────────────────────────
  // Debounced so a burst of incoming messages costs one PATCH; skipped when the
  // screen is not focused (the message stays unread until the user is back).
  const scheduleRead = useCallback(() => {
    if (!conversationId) return
    if (readTimerRef.current) clearTimeout(readTimerRef.current)
    readTimerRef.current = setTimeout(() => {
      readTimerRef.current = null
      if (!focusedRef.current) return
      authPatch<{ success: boolean }>(`/conversations/${conversationId}/read`, {}).catch(() => {})
    }, READ_DEBOUNCE_MS)
  }, [conversationId])

  useEffect(() => {
    if (isFocused) scheduleRead()
  }, [isFocused, scheduleRead])

  // ── Loading ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!conversationId) return
    setLoadError(false)
    try {
      const data = await authFetch<ThreadPage>(`/conversations/${conversationId}/messages?limit=${PAGE_SIZE}`)
      if (data) {
        setConversation(data.conversation)
        setHasMore(!!data.hasMore)
        // Keep this thread's still-pending bubbles (a reload must not eat an unsent message).
        setMessages((prev) =>
          mergeMessages(prev.filter((m) => m.conversationId === conversationId), data.messages ?? []),
        )
      }
    } catch {
      setLoadError(true)
    }
  }, [conversationId])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const retryLoad = useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    getSiteSettings()
      .then((s) => {
        settingsRef.current = s
        setQuickReplies(resolveQuickReplies(s.chatQuickReplies))
      })
      .catch(() => setQuickReplies(DEFAULT_QUICK_REPLIES))
  }, [])

  // Inverted list: the "end" is the top, i.e. the oldest loaded message.
  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || loadingOlderRef.current) return
    const before = firstServerId(messagesRef.current)
    if (!before) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const data = await authFetch<ThreadPage>(
        `/conversations/${conversationId}/messages?beforeId=${before}&limit=${PAGE_SIZE}`,
      )
      if (data) {
        setHasMore(!!data.hasMore)
        setMessages((prev) => mergeMessages(prev, data.messages ?? []))
      }
    } catch {
      // silent: the next scroll to the top tries again
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [conversationId, hasMore])

  // Forward catch-up after a socket gap (and after a Bro answer): page `afterId`
  // until the server has nothing newer.
  const catchUp = useCallback(async () => {
    if (!conversationId || catchingUpRef.current) return
    catchingUpRef.current = true
    try {
      for (let i = 0; i < CATCH_UP_MAX_PAGES; i++) {
        const after = lastServerId(messagesRef.current)
        const data = await authFetch<ThreadPage>(
          after
            ? `/conversations/${conversationId}/messages?afterId=${after}`
            : `/conversations/${conversationId}/messages?limit=${PAGE_SIZE}`,
        )
        if (!data) break
        const incoming = data.messages ?? []
        if (!after) setHasMore(!!data.hasMore)
        if (incoming.length) {
          messagesRef.current = mergeMessages(messagesRef.current, incoming)
          setMessages((prev) => mergeMessages(prev, incoming))
          if (incoming.some((m) => m.senderId !== me)) scheduleRead()
        }
        // Without a cursor the page is the newest one and `hasMore` means "older exist".
        if (!after || !data.hasMore || incoming.length === 0) break
      }
    } catch {
      // silent: the fallback poll or next reconnect retries
    } finally {
      catchingUpRef.current = false
    }
  }, [conversationId, me, scheduleRead])

  useFallbackPoll(() => { void catchUp() }, FALLBACK_POLL_MS)

  // ── Realtime ──────────────────────────────────────────────────────────────
  const clearPeerTyping = useCallback(() => {
    if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current)
    peerTypingTimerRef.current = null
    setOtherTyping(null)
  }, [])

  useChatEvents({
    'message:new': ({ message }) => {
      if (message.conversationId !== conversationId) return
      setMessages((prev) => mergeMessages(prev, [message]))
      if (message.senderId !== me) {
        clearPeerTyping()
        if (focusedRef.current) scheduleRead()
      }
    },
    typing: (e) => {
      if (e.conversationId !== conversationId || e.userId !== otherId) return
      if (!e.on) {
        clearPeerTyping()
        return
      }
      setOtherTyping(e.kind)
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current)
      peerTypingTimerRef.current = setTimeout(() => {
        peerTypingTimerRef.current = null
        setOtherTyping(null)
      }, PEER_TYPING_TTL_MS)
    },
    presence: (e) => {
      if (e.userId === otherId) setOnline(e.online)
    },
  })

  // The server forgets presence rooms on reconnect, so watch again on every connect.
  useEffect(() => {
    if (!connected) {
      setOnline(false)
      return
    }
    if (!otherId || otherIsBro) return
    getChatSocket()?.emit('presence:watch', { userId: otherId })
  }, [connected, otherId, otherIsBro])

  // ── Typing (outgoing) ─────────────────────────────────────────────────────
  const emitTyping = useCallback(
    (on: boolean) => {
      if (!conversationId || otherIsBro) return
      getChatSocket()?.emit('typing', { conversationId, kind: 'text', on })
    },
    [conversationId, otherIsBro],
  )

  const stopTyping = useCallback(() => {
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current)
    typingIdleRef.current = null
    if (!typingOnRef.current) return
    typingOnRef.current = false
    emitTyping(false)
  }, [emitTyping])

  const onChangeText = useCallback(
    (v: string) => {
      setText(v)
      if (!v.trim()) {
        stopTyping()
        return
      }
      const now = Date.now()
      if (!typingOnRef.current || now - lastTypingEmitRef.current >= TYPING_RESEND_MS) {
        typingOnRef.current = true
        lastTypingEmitRef.current = now
        emitTyping(true)
      }
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current)
      typingIdleRef.current = setTimeout(stopTyping, TYPING_IDLE_MS)
    },
    [emitTyping, stopTyping],
  )

  useEffect(() => {
    if (!isFocused) stopTyping()
  }, [isFocused, stopTyping])

  // Unmount: stop advertising typing and drop pending timers.
  const stopTypingRef = useRef(stopTyping)
  useEffect(() => { stopTypingRef.current = stopTyping }, [stopTyping])
  useEffect(
    () => () => {
      stopTypingRef.current()
      if (readTimerRef.current) clearTimeout(readTimerRef.current)
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current)
    },
    [],
  )

  // ── Sending (optimistic) ──────────────────────────────────────────────────
  const post = useCallback(
    (tempId: number, content: string, clientMsgId: string) => {
      authPost<ChatMessage>(`/conversations/${conversationId}/messages`, { type: 'text', content, clientMsgId })
        .then((msg) => setMessages((prev) => mergeMessages(prev, [msg])))
        .catch(() => setMessages((prev) => setLocalState(prev, tempId, 'failed')))
    },
    [conversationId],
  )

  const sendText = useCallback(
    (raw: string) => {
      const content = raw.trim()
      if (!content || !me || !conversationId) return
      stopTyping()
      const clientMsgId = uuidv4()
      const tempId = tempIdRef.current--
      const draft = makeTextDraft({
        tempId,
        conversationId,
        senderId: me,
        text: content,
        clientMsgId,
        now: new Date().toISOString(),
      })
      setMessages((prev) => [...prev, draft])
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      post(tempId, content, clientMsgId)
    },
    [me, conversationId, post, stopTyping],
  )

  const handleSend = useCallback(() => {
    const content = text
    setText('')
    sendText(content)
  }, [text, sendText])

  // Retry re-sends the same bubble with the same clientMsgId, so the server
  // de-duplicates if the first attempt actually landed.
  const retry = useCallback(
    (m: LocalMessage) => {
      if (m.id >= 0 || !m.clientMsgId) return
      setMessages((prev) => setLocalState(prev, m.id, 'sending'))
      post(m.id, m.content, m.clientMsgId)
    },
    [post],
  )

  const openStore = useCallback(() => {
    try {
      const s = settingsRef.current
      const url = StoreReview.storeUrl() ?? (Platform.OS === 'ios' ? s?.iosStoreUrl : s?.androidStoreUrl)
      if (url) Linking.openURL(url).catch(() => {})
    } catch {
      // silent: nothing actionable
    }
  }, [])

  const onBroAnswered = useCallback(() => { void catchUp() }, [catchUp])

  // ── Keyboard / Bro form ───────────────────────────────────────────────────
  // A FlatList doesn't scroll a focused field into view, so a Bro form input
  // can end up hidden. The list is inverted: offset 0 is the bottom and a larger
  // offset moves content down, so the delta is applied with the opposite sign.
  const revealFocusedInput = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput()
    const list = listRef.current?.getNativeScrollRef() as View | null | undefined
    if (!input || !list || input === composerRef.current) return
    list.measureInWindow((_lx, listY, _lw, listH) => {
      input.measureInWindow((_x, y, _w, h) => {
        const margin = spacing.lg
        if (y >= listY + margin && y + h <= listY + listH - margin) return
        listRef.current?.scrollToOffset({
          offset: Math.max(0, scrollYRef.current - (y - listY - margin)),
          animated: true,
        })
      })
    })
  }, [])

  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false)),
      Keyboard.addListener('keyboardDidShow', revealFocusedInput),
    ]
    return () => subs.forEach((s) => s.remove())
  }, [revealFocusedInput])

  // ── Derived ───────────────────────────────────────────────────────────────
  const product = conversation?.product ?? null
  const productImg = imgUrl(product?.image)
  const otherName = otherIsBro ? t.bro.name : (other?.displayName ?? t.messages)
  const otherIsStore = other?.isStore ?? false
  const otherLogo = imgUrl(other?.logo)
  const subline = otherTyping
    ? otherTyping === 'voice'
      ? t.chat.recordingVoice
      : t.chat.typing
    : online
      ? t.chat.online
      : otherIsStore
        ? t.store
        : t.user
  const sublineLive = !!otherTyping || online
  // Bro's details form takes text input itself; composer text is ignored by Bro until it's submitted.
  const broFormOpen = !!messages[messages.length - 1]?.meta?.bro?.actions?.includes('details')
  const showChips =
    !!conversation && !!me && !broFormOpen && shouldShowChips({ me, conversation, messageCount: messages.length })

  // Rows are built oldest -> newest (each date separator before its day), then
  // reversed for the inverted list so the newest message sits at the bottom.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    let lastDay = ''
    for (const m of messages) {
      const k = dateKey(m.createdAt)
      if (k !== lastDay) {
        out.push({ kind: 'separator', id: `sep-${k}`, label: dateLabel(m.createdAt, ar) })
        lastDay = k
      }
      // Key by clientMsgId when present so the optimistic bubble keeps its row once confirmed.
      out.push({ kind: 'message', id: m.clientMsgId ? `c-${m.clientMsgId}` : `m-${m.id}`, message: m })
    }
    return out.reverse()
  }, [messages, ar])

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'separator') {
        return (
          <View style={styles.dateSepWrap}>
            <View style={styles.dateSepLine} />
            <Text style={styles.dateSepText}>{item.label}</Text>
            <View style={styles.dateSepLine} />
          </View>
        )
      }
      return (
        <MessageBubble
          message={item.message}
          mine={item.message.senderId === me}
          onRetry={retry}
          onBroAnswered={onBroAnswered}
          onOpenStore={openStore}
        />
      )
    },
    [styles, me, retry, onBroAnswered, openStore],
  )

  const header = (
    <>
        <View style={[styles.headerRow, rowDir]}>
          {otherIsBro ? (
            <BroAvatar size={44} radius={14} />
          ) : (
          <View style={styles.headerAvatarWrap}>
            <View
              style={[
                styles.headerAvatar,
                otherIsStore ? styles.headerAvatarStore : styles.headerAvatarUser,
              ]}
            >
              {otherLogo ? (
                <Image source={{ uri: otherLogo }} style={styles.headerAvatarImg} />
              ) : (
                <Text style={styles.headerAvatarInitial}>
                  {(otherName || '?').trim().charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.headerTypeBadge,
                ar ? { left: -2 } : { right: -2 },
                otherIsStore ? styles.headerTypeBadgeStore : styles.headerTypeBadgeUser,
              ]}
            >
              <Ionicons
                name={otherIsStore ? 'storefront' : 'person'}
                size={9}
                color={otherIsStore ? colors.dk : colors.white}
              />
            </View>
          </View>
          )}

          <View style={[styles.headerText, colDir]}>
            <Text
              numberOfLines={1}
              style={[styles.headerName, dirStyle]}
            >
              {otherName}
            </Text>
            {otherIsBro ? (
              <View style={styles.headerBadgeWrap}>
                <BroBadge label={t.bro.badge} />
              </View>
            ) : (
              <Text
                numberOfLines={1}
                style={[styles.headerRole, sublineLive && styles.headerRoleLive, dirStyle]}
              >
                {subline}
              </Text>
            )}
          </View>
        </View>

        {/* Product context card */}
        {product ? (
          <View style={styles.productBarWrap}>
            <Pressable
              onPress={() => router.push(`/products/${product.id}`)}
              style={({ pressed }) => [
                styles.productBar,
                rowDir,
                pressed && styles.productBarPressed,
              ]}
            >
              {productImg ? (
                <Image source={{ uri: productImg }} style={styles.productImg} />
              ) : (
                <View style={styles.productImgFallback}>
                  <Ionicons name="cube-outline" size={20} color={colors.yd} />
                </View>
              )}
              <View style={[styles.productMeta, colDir]}>
                <Text style={[styles.productLabel, dirStyle]}>
                  {t.aboutProduct}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.productTitle, dirStyle]}
                >
                  {product.title}
                </Text>
              </View>
              <View style={styles.viewBtn}>
                <Ionicons
                  name={ar ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.dk}
                />
              </View>
            </Pressable>
          </View>
        ) : null}
    </>
  )

  const emptyView = (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={30} color={colors.yd} />
      </View>
      <Text style={styles.emptyTitle}>{t.startConversation}</Text>
      <Text style={styles.emptyText}>
        {ar ? 'اكتب أول رسالة لبدء المحادثة' : 'Send your first message to start the conversation'}
      </Text>
    </View>
  )

  return (
    <DashboardLayout title={otherName} scroll={false} contentPadding={false}>
      {header}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.y} size="large" />
        </View>
      ) : loadError ? (
        <ErrorState kind="network" onRetry={retryLoad} style={styles.flex} />
      ) : rows.length === 0 ? (
        // Rendered outside the list: an inverted list would draw its empty view upside down.
        emptyView
      ) : (
        <FlatList
          ref={listRef}
          inverted
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={() => { void loadOlder() }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingOlder ? <ActivityIndicator color={colors.y} style={styles.olderSpinner} /> : null
          }
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <View
        style={[
          styles.inputBarWrap,
          { paddingBottom: keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {broFormOpen ? (
          <Text style={styles.broFormHint}>{t.bro.formComposerHint}</Text>
        ) : (
          <>
            {showChips ? <QuickReplies items={quickReplies} onPick={sendText} /> : null}
            <Composer
              ref={composerRef}
              value={text}
              onChangeText={onChangeText}
              onSend={handleSend}
              onBlur={stopTyping}
            />
          </>
        )}
      </View>
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerAvatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarStore: {
    backgroundColor: colors.yellowBg,
    borderWidth: 2,
    borderColor: colors.y,
  },
  headerAvatarUser: {
    backgroundColor: colors.placeholder,
    borderWidth: 2,
    borderColor: colors.border,
  },
  headerAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerAvatarInitial: {
    fontFamily: fonts.black,
    fontSize: 18,
    lineHeight: 22,
    color: colors.heading,
  },
  headerTypeBadge: {
    position: 'absolute',
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  headerTypeBadgeStore: {
    backgroundColor: colors.y,
  },
  headerTypeBadgeUser: {
    backgroundColor: colors.fab,
  },
  headerText: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.heading,
  },
  headerBadgeWrap: {
    marginTop: 2,
    alignItems: 'flex-start',
  },
  headerRole: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },

  productBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
  },
  productBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.yellowBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.y,
    ...(dark ? null : shadow.ss),
  },
  productBarPressed: {
    opacity: 0.85,
  },
  productImg: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    resizeMode: 'cover',
    borderWidth: 1,
    borderColor: colors.y,
  },
  productImgFallback: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMeta: { flex: 1, minWidth: 0 },
  productLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.yd,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  productTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.heading,
    marginTop: 2,
  },
  viewBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: {
    padding: spacing.md,
    gap: spacing.xs,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.yellowBg,
    borderWidth: 1.5,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.heading,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  dateSepWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  dateSepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dateSepText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.muted,
  },

  headerRoleLive: {
    fontFamily: fonts.semiBold,
    color: colors.green,
  },
  olderSpinner: {
    marginVertical: spacing.md,
  },

  inputBarWrap: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...(dark ? null : shadow.sm),
  },
  broFormHint: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
})
