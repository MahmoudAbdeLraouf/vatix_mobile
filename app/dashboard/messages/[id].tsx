import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { ConversationDetail, ConversationListItem, imgUrl, Message } from '@/lib/api'
import { authFetch, authPatch, authPost } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

function timeLabel(iso: string, ar: boolean): string {
  if (!iso) return ''
  const locale = ar ? 'ar-EG' : 'en-US'
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

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
  | { kind: 'message'; id: string; message: Message }

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
  const trailAlign = {
    alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
  }
  const { user } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()

  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [other, setOther] = useState<ConversationListItem['otherUser'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)
  const lastIdRef = useRef<number>(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const markAsRead = useCallback(() => {
    if (!id) return
    authPatch<{ success: boolean }>(`/conversations/${id}/read`, {}).catch(() => {})
  }, [id])

  const load = useCallback(async () => {
    const data = await authFetch<ConversationDetail>(`/conversations/${id}/messages`)
    if (data) {
      setDetail(data)
      const msgs = data.messages ?? []
      setMessages(msgs)
      lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0
    }
  }, [id])

  const poll = useCallback(async () => {
    if (!id) return
    try {
      const data = await authFetch<ConversationDetail>(
        `/conversations/${id}/messages?afterId=${lastIdRef.current}`,
      )
      if (!data) return
      const incoming = data.messages ?? []
      if (incoming.length > 0) {
        setMessages((prev) => [...prev, ...incoming])
        lastIdRef.current = incoming[incoming.length - 1].id
        markAsRead()
      }
    } catch {
      // silent
    }
  }, [id, markAsRead])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!detail || !user) return
    authFetch<ConversationListItem[]>('/conversations')
      .then((list) => {
        const found = list?.find((c) => c.id === Number(id))
        if (found) setOther(found.otherUser)
      })
      .catch(() => {})
  }, [detail, user, id])

  useEffect(() => {
    markAsRead()
  }, [markAsRead])

  useEffect(() => {
    pollingRef.current = setInterval(poll, 3000)
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') poll()
    })
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      sub.remove()
    }
  }, [poll])

  useFocusEffect(
    useCallback(() => {
      poll()
      markAsRead()
    }, [poll, markAsRead]),
  )

  const scrollToBottom = (animated = true) => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 80)
  }

  async function handleSend() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setText('')
    try {
      const msg = await authPost<Message>(`/conversations/${id}/messages`, { content })
      setMessages((prev) => [...prev, msg])
      lastIdRef.current = msg.id
      scrollToBottom()
    } catch {
      setText(content)
    } finally {
      setSending(false)
    }
  }

  const conversation = detail?.conversation
  const product = conversation?.product
  const productImg = imgUrl(product?.image)

  const otherName = other?.displayName ?? t.messages
  const otherIsStore = other?.isStore ?? false
  const otherLogo = imgUrl(other?.logo)

  // Build rows: date separators + messages
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    let lastDay = ''
    for (const m of messages) {
      const k = dateKey(m.createdAt)
      if (k !== lastDay) {
        out.push({ kind: 'separator', id: `sep-${k}`, label: dateLabel(m.createdAt, ar) })
        lastDay = k
      }
      out.push({ kind: 'message', id: `msg-${m.id}`, message: m })
    }
    return out
  }, [messages, ar])

  return (
    <DashboardLayout title={otherName} scroll={false} contentPadding={false}>
        {/* Custom header row with avatar + role */}
        <View style={[styles.headerRow, rowDir]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          >
            <Ionicons
              name={ar ? 'chevron-forward' : 'chevron-back'}
              size={22}
              color={colors.dk}
            />
          </Pressable>

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

          <View style={[styles.headerText, colDir]}>
            <Text
              numberOfLines={1}
              style={[styles.headerName, dirStyle]}
            >
              {otherName}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.headerRole, dirStyle]}
            >
              {otherIsStore ? t.store : t.user}
            </Text>
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

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.y} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => scrollToBottom(false)}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={30} color={colors.yd} />
                </View>
                <Text style={styles.emptyTitle}>{t.startConversation}</Text>
                <Text style={styles.emptyText}>
                  {ar
                    ? 'اكتب أول رسالة لبدء المحادثة'
                    : 'Send your first message to start the conversation'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.kind === 'separator') {
                return (
                  <View style={styles.dateSepWrap}>
                    <View style={styles.dateSepLine} />
                    <Text style={styles.dateSepText}>{item.label}</Text>
                    <View style={styles.dateSepLine} />
                  </View>
                )
              }
              const m = item.message
              const mine = m.senderId === user?.id
              // Website intentionally aligns "mine" to flex-start; mirror that here.
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    { justifyContent: mine ? 'flex-start' : 'flex-end' },
                  ]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text
                      style={[
                        styles.bubbleText,
                        mine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                        dirStyle,
                      ]}
                    >
                      {m.content}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs,
                      ]}
                    >
                      {timeLabel(m.createdAt, ar)}
                      {mine ? (m.isRead ? '  ✓✓' : '  ✓') : ''}
                    </Text>
                  </View>
                </View>
              )
            }}
          />
        )}

        <View style={[styles.inputBarWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <View style={styles.inputBar}>
            <View style={styles.inputPill}>
              <TextInput
                style={[styles.input, dirStyle]}
                value={text}
                onChangeText={setText}
                placeholder={t.typeMessage}
                placeholderTextColor={colors.g400}
                multiline
                maxLength={2000}
                editable={!sending}
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendBtnDisabled,
                pressed && !(!text.trim() || sending) && styles.sendBtnPressed,
              ]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator
                  color={!text.trim() ? colors.g400 : colors.dk}
                  size="small"
                />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={!text.trim() ? colors.g400 : colors.dk}
                  style={ar ? { transform: [{ scaleX: -1 }] } : undefined}
                />
              )}
            </Pressable>
          </View>
        </View>
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.g200,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.g100,
  },
  backBtnPressed: {
    backgroundColor: colors.g200,
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
    backgroundColor: colors.yl,
    borderWidth: 2,
    borderColor: colors.y,
  },
  headerAvatarUser: {
    backgroundColor: colors.g100,
    borderWidth: 2,
    borderColor: colors.g200,
  },
  headerAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerAvatarInitial: {
    fontFamily: fonts.black,
    fontSize: 18,
    lineHeight: 22,
    color: colors.dk,
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
    borderColor: colors.white,
  },
  headerTypeBadgeStore: {
    backgroundColor: colors.y,
  },
  headerTypeBadgeUser: {
    backgroundColor: colors.dk,
  },
  headerText: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  headerRole: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    marginTop: 1,
  },

  productBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
  },
  productBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.yl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.y,
    ...shadow.ss,
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
    backgroundColor: colors.white,
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
    color: colors.dk,
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
    backgroundColor: colors.yl,
    borderWidth: 1.5,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.dk,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
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
    backgroundColor: colors.g200,
  },
  dateSepText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g500,
  },

  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.dk,
    borderTopStartRadius: 4,
    borderTopEndRadius: 14,
    borderBottomStartRadius: 14,
    borderBottomEndRadius: 14,
    ...shadow.ss,
  },
  bubbleTheirs: {
    backgroundColor: colors.g100,
    borderTopStartRadius: 14,
    borderTopEndRadius: 4,
    borderBottomStartRadius: 14,
    borderBottomEndRadius: 14,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  bubbleText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.g900 },
  bubbleTime: {
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: colors.white,
    opacity: 0.7,
    textAlign: 'right',
  },
  bubbleTimeTheirs: {
    color: colors.g500,
  },

  inputBarWrap: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.g200,
    ...shadow.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xs,
  },
  inputPill: {
    flex: 1,
    backgroundColor: colors.g100,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.g200,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: 48,
    maxHeight: 140,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.dk,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  sendBtnDisabled: {
    backgroundColor: colors.g100,
    borderWidth: 1,
    borderColor: colors.g200,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
})
